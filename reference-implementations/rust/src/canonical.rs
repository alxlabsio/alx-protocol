//! ALX Protocol — Canonicalization.
//! Deterministic JSON serialization matching the JS implementation.

use serde_json::{Number, Value};

const MAX_DEPTH: usize = 128;
const MAX_SAFE_INTEGER: i64 = (1i64 << 53) - 1;
const MIN_SAFE_INTEGER: i64 = -((1i64 << 53) - 1);

pub fn canonicalize(value: &Value) -> Result<String, String> {
    canonicalize_inner(value, 0)
}

fn canonicalize_inner(value: &Value, depth: usize) -> Result<String, String> {
    if depth > MAX_DEPTH {
        return Err(format!(
            "[ALX_CANONICALIZATION_DEPTH] Canonicalization depth exceeded {MAX_DEPTH}"
        ));
    }
    match value {
        Value::Null => Ok("null".into()),
        Value::Bool(b) => Ok(if *b { "true" } else { "false" }.into()),
        Value::Number(n) => canonicalize_number(n),
        Value::String(s) => serde_json::to_string(s).map_err(|e| e.to_string()),
        Value::Array(a) => {
            let parts: Result<Vec<String>, String> =
                a.iter().map(|v| canonicalize_inner(v, depth + 1)).collect();
            Ok(format!("[{}]", parts?.join(",")))
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            let parts: Result<Vec<String>, String> = keys
                .iter()
                .map(|k| {
                    let key_json = serde_json::to_string(*k).map_err(|e| e.to_string())?;
                    let val = canonicalize_inner(&map[*k], depth + 1)?;
                    Ok(format!("{key_json}:{val}"))
                })
                .collect();
            Ok(format!("{{{}}}", parts?.join(",")))
        }
    }
}

fn canonicalize_number(n: &Number) -> Result<String, String> {
    if let Some(i) = n.as_i64() {
        if !(MIN_SAFE_INTEGER..=MAX_SAFE_INTEGER).contains(&i) {
            return Err(format!(
                "[ALX_CANONICALIZATION_UNSAFE_INTEGER] Integer out of safe range: {i}"
            ));
        }
        return Ok(i.to_string());
    }
    if let Some(u) = n.as_u64() {
        if u > MAX_SAFE_INTEGER as u64 {
            return Err(format!(
                "[ALX_CANONICALIZATION_UNSAFE_INTEGER] Integer out of safe range: {u}"
            ));
        }
        return Ok(u.to_string());
    }
    if let Some(f) = n.as_f64() {
        if !f.is_finite() {
            return Err("[ALX_CANONICALIZATION_NON_FINITE] Non-finite number not allowed".into());
        }
        if f == 0.0 && f.is_sign_negative() {
            return Ok("0".into());
        }
        if f.fract() == 0.0 {
            if f < MIN_SAFE_INTEGER as f64 || f > MAX_SAFE_INTEGER as f64 {
                return Err(format!(
                    "[ALX_CANONICALIZATION_UNSAFE_INTEGER] Integer out of safe range: {f}"
                ));
            }
            return Ok((f as i64).to_string());
        }
        Ok(format_float_js(f))
    } else {
        Err("[ALX_CANONICALIZATION_UNSUPPORTED_TYPE] unsupported number".into())
    }
}

/// Format a float to match JavaScript JSON.stringify output exactly.
///
/// JS uses decimal notation when 1e-6 <= |value| < 1e21, and scientific
/// notation otherwise. serde_json/ryu has a different threshold (uses
/// scientific for 1e-6), so we must override.
fn format_float_js(f: f64) -> String {
    let s = match Number::from_f64(f) {
        Some(n) => serde_json::to_string(&Value::Number(n)).unwrap_or_else(|_| format!("{f}")),
        None => format!("{f}"),
    };

    let abs = f.abs();
    if (s.contains('e') || s.contains('E')) && (1e-6..1e21).contains(&abs) {
        return expand_scientific_decimal(&s);
    }

    s
}

fn expand_scientific_decimal(value: &str) -> String {
    let (mantissa, exponent) = value
        .split_once('e')
        .or_else(|| value.split_once('E'))
        .expect("scientific notation contains an exponent");
    let exponent: i32 = exponent.parse().expect("scientific exponent is an integer");
    let negative = mantissa.starts_with('-');
    let unsigned = mantissa.strip_prefix('-').unwrap_or(mantissa);
    let decimal_index = unsigned.find('.').unwrap_or(unsigned.len()) as i32 + exponent;
    let digits = unsigned.replace('.', "");

    let expanded = if decimal_index <= 0 {
        format!("0.{}{}", "0".repeat((-decimal_index) as usize), digits)
    } else if decimal_index as usize >= digits.len() {
        format!(
            "{}{}",
            digits,
            "0".repeat(decimal_index as usize - digits.len())
        )
    } else {
        let index = decimal_index as usize;
        format!("{}.{}", &digits[..index], &digits[index..])
    };

    if negative {
        format!("-{expanded}")
    } else {
        expanded
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn null_canonicalizes_to_null() {
        assert_eq!(canonicalize(&json!(null)).unwrap(), "null");
    }

    #[test]
    fn keys_sorted() {
        assert_eq!(
            canonicalize(&json!({"b": 1, "a": 2})).unwrap(),
            r#"{"a":2,"b":1}"#
        );
    }

    #[test]
    fn array_order_preserved() {
        assert_eq!(canonicalize(&json!([3, 1, 2])).unwrap(), "[3,1,2]");
    }

    #[test]
    fn nested_sort() {
        assert_eq!(
            canonicalize(&json!({"b": {"d": 1, "c": 2}, "a": 3})).unwrap(),
            r#"{"a":3,"b":{"c":2,"d":1}}"#
        );
    }
}
