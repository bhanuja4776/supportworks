import { forwardRef, useImperativeHandle, useRef } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { RichEditor } from "react-native-pell-rich-editor";
import { colors } from "@/src/theme";

export type RichNoteHandle = {
  insertText: (t: string) => void;
  insertImage: (dataUri: string) => void;
  setForeColor: (c: string) => void;
  setFontSize: (level: number) => void;
  setBold: () => void;
  setItalic: () => void;
  focus: () => void;
};

type Props = {
  initialHTML: string;
  textColor: string;
  bgColor: string;
  placeholder?: string;
  onChange: (html: string) => void;
  editorRef?: (ref: RichEditor | null) => void;
};

/**
 * Full rich-text note editor (WebView-based). Supports colouring selected text,
 * typing in a chosen colour, and inserting photos inline at the cursor.
 */
export const RichNoteEditor = forwardRef<RichNoteHandle, Props>(function RichNoteEditor(
  { initialHTML, textColor, bgColor, placeholder, onChange },
  ref
) {
  const rich = useRef<RichEditor>(null);

  useImperativeHandle(ref, () => ({
    insertText: (t: string) => rich.current?.insertText(t),
    insertImage: (dataUri: string) => rich.current?.insertImage(dataUri),
    setForeColor: (c: string) => rich.current?.setForeColor(c),
    setFontSize: (level: number) => rich.current?.setFontSize(level as any),
    setBold: () => rich.current?.commandDOM?.("document.execCommand('bold', false, null)"),
    setItalic: () => rich.current?.commandDOM?.("document.execCommand('italic', false, null)"),
    focus: () => rich.current?.focusContentEditor(),
  }));

  return (
    <View style={styles.wrap}>
      <RichEditor
        ref={rich}
        initialContentHTML={initialHTML}
        placeholder={placeholder}
        onChange={onChange}
        useContainer
        initialHeight={320}
        editorStyle={{
          backgroundColor: bgColor,
          color: textColor,
          placeholderColor: textColor + "66",
          contentCSSText: `font-size: 16px; line-height: 1.6; padding-bottom: 40px; img { max-width: 100%; border-radius: 10px; margin: 8px 0; }`,
        }}
      />
    </View>
  );
});

// Plain-text fallback for web (WebView-based editor doesn't run on web preview).
export function PlainNoteFallback({
  value, onChangeText, textColor, fontSize, placeholder, testID,
}: {
  value: string; onChangeText: (t: string) => void; textColor: string; fontSize: number; placeholder?: string; testID?: string;
}) {
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      multiline
      placeholder={placeholder}
      placeholderTextColor={textColor + "66"}
      style={[styles.fallback, { color: textColor, fontSize }]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 320 },
  fallback: { minHeight: 320, textAlignVertical: "top", lineHeight: 26, color: colors.onSurface },
});
