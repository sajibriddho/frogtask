"use client";

import * as React from "react";
import Select, {
  Props as ReactSelectProps,
  StylesConfig,
  CSSObjectWithLabel,
  GroupBase,
} from "react-select";

/**
 * StyledSelect - A reusable React Select component with consistent styling
 *
 * This component wraps react-select with pre-configured styles that match
 * the application's design system. It uses inline styles for dynamic theming
 * and CSS classes for consistent appearance.
 *
 * @example
 * ```tsx
 * <StyledSelect
 *   options={[
 *     { value: 'option1', label: 'Option 1' },
 *     { value: 'option2', label: 'Option 2' }
 *   ]}
 *   placeholder="Select an option"
 *   onChange={(option) => console.log(option)}
 * />
 * ```
 */

// Type for option
export interface SelectOption {
  value: string;
  label: string;
}

// Shared react-select styles configuration
const customSelectStyles: StylesConfig<SelectOption, false> = {
  control: (base: CSSObjectWithLabel, state) => ({
    ...base,
    minHeight: "36px",
    height: "36px",
    borderRadius: "6px",
    borderWidth: state.isFocused ? "2px" : "1px",
    borderColor: "hsl(var(--primary))",
    borderStyle: "solid",
    backgroundColor: "rgb(255, 255, 255)",
    boxShadow: "none",
    outline: "none",
    transition: "border-color 0.2s ease, border-width 0.2s ease",
    "&:hover": {
      borderColor: "hsl(var(--primary))",
      borderWidth: "1px",
      borderStyle: "solid",
    },
    "&:focus": {
      borderColor: "hsl(var(--primary))",
      borderWidth: "2px",
      borderStyle: "solid",
    },
    "&:focus-within": {
      borderColor: "hsl(var(--primary))",
      borderWidth: "2px",
      borderStyle: "solid",
    },
  }),
  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    backgroundColor: "rgb(255, 255, 255)",
    border: "1px solid hsl(var(--primary))",
    boxShadow:
      "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    zIndex: 50,
    borderRadius: "6px",
    overflow: "hidden",
  }),
  menuList: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "4px",
  }),
  option: (base: CSSObjectWithLabel, state) => ({
    ...base,
    backgroundColor: state.isFocused
      ? "hsl(var(--primary) / 0.1)"
      : "rgb(255, 255, 255)",
    color: "rgb(17, 24, 39)",
    cursor: "pointer",
    fontSize: "0.875rem",
    borderRadius: "4px",
    padding: "8px 12px",
    "&:active": {
      backgroundColor: "hsl(var(--primary) / 0.15)",
    },
  }),
  singleValue: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "rgb(17, 24, 39)",
    fontSize: "0.875rem",
  }),
  input: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "rgb(17, 24, 39)",
    margin: "0",
    padding: "0",
  }),
  placeholder: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "rgb(156, 163, 175)",
    fontSize: "0.875rem",
  }),
  valueContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "0 12px",
    height: "36px",
  }),
  indicatorsContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    height: "36px",
  }),
  indicatorSeparator: (base: CSSObjectWithLabel) => ({
    ...base,
    display: "none",
  }),
  clearIndicator: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "rgb(156, 163, 175)",
    padding: "8px",
    "&:hover": {
      color: "hsl(var(--primary))",
      backgroundColor: "transparent",
    },
  }),
  dropdownIndicator: (base: CSSObjectWithLabel, state) => ({
    ...base,
    color: "rgb(156, 163, 175)",
    padding: "8px",
    transition: "all 0.2s ease",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "rotate(0deg)",
    "&:hover": {
      color: "hsl(var(--primary))",
      backgroundColor: "transparent",
    },
  }),
};

// Type for the component props
export type StyledSelectProps<T = SelectOption> = ReactSelectProps<
  T,
  false,
  GroupBase<T>
>;

/**
 * StyledSelect Component
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const StyledSelect = React.forwardRef<any, StyledSelectProps>(
  ({ styles, className, classNamePrefix = "react-select", ...props }, ref) => {
    // Merge custom styles with any provided styles
    const mergedStyles = React.useMemo(() => {
      if (!styles) return customSelectStyles;

      // Simple merge: use provided styles where they exist, otherwise use custom
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const merged: any = { ...customSelectStyles };
      Object.keys(styles).forEach((key) => {
        const styleKey = key as keyof typeof styles;
        if (styles[styleKey]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          merged[styleKey as any] = styles[styleKey];
        }
      });
      return merged as StylesConfig<SelectOption>;
    }, [styles]);

    return (
      <div className="react-select-container">
        <Select
          ref={ref}
          styles={mergedStyles}
          className={className}
          classNamePrefix={classNamePrefix}
          {...props}
        />
      </div>
    );
  },
);

StyledSelect.displayName = "StyledSelect";

export default StyledSelect;
