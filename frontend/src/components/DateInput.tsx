import { useEffect, useState } from "react";
import { TextInput, StyleSheet, TextStyle } from "react-native";
import { toDMY, fromDMY } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

type Props = {
  value: string; // ISO YYYY-MM-DD
  onChange: (iso: string) => void; // called with ISO (or "" if cleared/incomplete)
  placeholder?: string;
  testID?: string;
  style?: TextStyle | TextStyle[];
};

/**
 * Australian date entry. Displays & accepts DD/MM/YYYY, auto-inserting slashes,
 * and emits an ISO YYYY-MM-DD string (or "" while incomplete).
 */
export function DateInput({ value, onChange, placeholder = "DD/MM/YYYY", testID, style }: Props) {
  const [text, setText] = useState(toDMY(value));

  useEffect(() => { setText(toDMY(value)); }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    const iso = fromDMY(out);
    onChange(iso); // "" while incomplete
  };

  return (
    <TextInput
      testID={testID}
      value={text}
      onChangeText={handle}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType="number-pad"
      style={style || styles.input}
      maxLength={10}
    />
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
});
