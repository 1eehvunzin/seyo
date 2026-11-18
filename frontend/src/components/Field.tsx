import { forwardRef } from 'react';
import { TextInput, TextInputInstance, TextInputProps, View } from 'react-native';
import { C, F } from '@/theme';
import { T } from './ui';

type Props = TextInputProps & { label?: string; width?: number | `${number}%`; dashed?: boolean; error?: boolean };

/** Rounded 56px input from the survey screens. */
export const Field = forwardRef<TextInputInstance, Props>(function Field({ label, width, dashed, error, style, ...rest }, ref) {
  const input = (
    <TextInput
      ref={ref}
      accessibilityLabel={label ?? rest.placeholder}
      placeholderTextColor={C.faint}
      allowFontScaling={false}
      {...rest}
      style={[
        {
          width,
          height: 56,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderColor: error ? C.error : C.line,
          paddingHorizontal: 18,
          fontFamily: F[400],
          fontSize: 17,
          color: C.ink,
        },
        style,
      ]}
    />
  );
  if (!label) return input;
  return (
    <View style={{ gap: 8 }}>
      <T s={13} c={C.muted}>
        {label}
      </T>
      {input}
    </View>
  );
});
