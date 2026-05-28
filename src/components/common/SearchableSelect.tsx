"use client";

/**
 * SearchableSelect  Reusable searchable dropdown component.
 *
 * Built on react-select and the shared StyledSelect styling.
 * Use this instead of native <select> wherever a searchable dropdown is needed.
 *
 * @example
 * <SearchableSelect
 *   options={locations.map(l => ({ value: l.id, label: l.name }))}
 *   value={selectedId}
 *   onChange={setSelectedId}
 *   placeholder="Select a location"
 * />
 */

import * as React from "react";
import Select, {
  StylesConfig,
  CSSObjectWithLabel,
  GroupBase,
  SingleValue,
  components,
  OptionProps,
  SingleValueProps,
} from "react-select";
import { cn } from "@/lib/utils";

// ------------
// Types
// ------------

export interface SelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  /** Available options. */
  options: SelectOption[];
  /** Currently selected value (the option's `value` string). */
  value?: string | null;
  /** Called with the selected option's `value` string, or null when cleared. */
  onChange?: (value: string | null) => void;
  placeholder?: string;
  isDisabled?: boolean;
  /** When true shows a clear (Ã—) button. */
  isClearable?: boolean;
  /** Pass `true` to show error ring. */
  hasError?: boolean;
  className?: string;
  /** Forwarded to the inner react-select input for accessibility. */
  inputId?: string;
  /** ARIA label for the control (use when there is no visible label). */
  "aria-label"?: string;
  /**
   * DOM element to portal the dropdown menu into. Pass `document.body` when
   * using inside a Dialog/Modal to avoid clipping by CSS transforms.
   */
  menuPortalTarget?: HTMLElement | null;
  /**
   * Override the menu CSS position strategy.
   * Pass `"fixed"` inside a Dialog to escape overflow clipping without
   * portaling (keeps the menu in the dialog DOM, preventing Radix
   * onPointerDownOutside from swallowing option clicks).
   */
  menuPosition?: "fixed" | "absolute";
  /**
   * Stable instance ID for react-select. When provided, prevents
   * SSR/client hydration mismatches caused by auto-incrementing IDs.
   */
  instanceId?: string;
}

// ------------
// Styles
// ------------

const buildStyles = (
  hasError: boolean,
): StylesConfig<SelectOption, false, GroupBase<SelectOption>> => ({
  control: (base: CSSObjectWithLabel, state) => ({
    ...base,
    minHeight: "36px",
    height: "36px",
    borderRadius: "6px",
    borderWidth: "1px",
    borderColor: hasError
      ? "var(--color-destructive)"
      : state.isFocused
        ? "var(--color-ring)"
        : "var(--color-input)",
    borderStyle: "solid",
    backgroundColor: "var(--color-background)",
    boxShadow: state.isFocused ? `0 0 0 1px var(--color-ring)` : "none",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    "&:hover": {
      borderColor: hasError ? "var(--color-destructive)" : "var(--color-ring)",
    },
  }),
  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    backgroundColor: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    boxShadow:
      "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    zIndex: 9999,
    borderRadius: "6px",
    overflow: "hidden",
  }),
  menuPortal: (base: CSSObjectWithLabel) => ({
    ...base,
    zIndex: 9999,
  }),
  menuList: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "4px",
    maxHeight: "200px",
  }),
  option: (base: CSSObjectWithLabel, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--color-primary)"
      : state.isFocused
        ? "var(--color-muted)"
        : "transparent",
    color: state.isSelected
      ? "var(--color-primary-foreground)"
      : "var(--color-popover-foreground)",
    cursor: "pointer",
    fontSize: "0.875rem",
    borderRadius: "4px",
    padding: "7px 10px",
    "&:active": {
      backgroundColor: "var(--color-primary)",
      color: "var(--color-primary-foreground)",
    },
  }),
  singleValue: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "var(--color-foreground)",
    fontSize: "0.875rem",
    opacity: 1,
    visibility: "visible",
  }),
  input: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "var(--color-foreground)",
    fontSize: "0.875rem",
    margin: "0",
    padding: "0",
  }),
  placeholder: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "var(--color-muted-foreground)",
    fontSize: "0.875rem",
  }),
  valueContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "0 10px",
    height: "36px",
  }),
  indicatorsContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    height: "36px",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  clearIndicator: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "rgb(156, 163, 175)",
    padding: "6px",
    "&:hover": {
      color: "var(--color-ring)",
      backgroundColor: "transparent",
    },
  }),
  dropdownIndicator: (base: CSSObjectWithLabel, state) => ({
    ...base,
    color: "rgb(156, 163, 175)",
    padding: "6px 8px",
    transition: "transform 0.2s ease",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "rotate(0deg)",
    "&:hover": {
      color: "var(--color-ring)",
      backgroundColor: "transparent",
    },
  }),
  noOptionsMessage: (base: CSSObjectWithLabel) => ({
    ...base,
    fontSize: "0.875rem",
    color: "var(--color-muted-foreground)",
    padding: "8px 12px",
  }),
});

// ------------
// Custom components — defined at module scope so their identity is stable
// across renders. (react-select v5 will reset selected-value rendering if
// the `components` prop's child references change every render.)
// ------------

const StableOption = (props: OptionProps<SelectOption, false>) => (
  <components.Option {...props}>
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "inherit" }}>{props.data.label}</span>
      {props.isSelected ? (
        <span
          className="text-xs font-semibold"
          style={{ color: "inherit", opacity: 0.8 }}
        >
          Selected
        </span>
      ) : null}
    </div>
  </components.Option>
);

const StableSingleValue = (props: SingleValueProps<SelectOption, false>) => (
  <components.SingleValue {...props}>
    <span className="text-foreground">{props.data.label}</span>
  </components.SingleValue>
);

const STABLE_COMPONENTS = {
  Option: StableOption,
  SingleValue: StableSingleValue,
};

// ------------
// Component
// ------------

export const SearchableSelect = React.forwardRef<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  SearchableSelectProps
>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "Select…",
      isDisabled = false,
      isClearable = false,
      hasError = false,
      className,
      inputId,
      "aria-label": ariaLabel,
      menuPortalTarget,
      menuPosition: menuPositionProp,
      instanceId,
    },
    ref,
  ) => {
    const styles = React.useMemo(() => buildStyles(hasError), [hasError]);

    const normalizedOptions = React.useMemo(
      () =>
        options.map((o) => {
          const optionValue = String(o.value);
          const label =
            typeof o.label === "string" && o.label.trim().length > 0
              ? o.label
              : optionValue;
          return { value: optionValue, label };
        }),
      [options],
    );

    const normalizedValue =
      value === null || value === undefined ? null : String(value);

    const selectedOption = React.useMemo(
      () =>
        normalizedValue != null
          ? (normalizedOptions.find((o) => o.value === normalizedValue) ?? null)
          : null,
      [normalizedOptions, normalizedValue],
    );

    const handleChange = React.useCallback(
      (opt: SingleValue<SelectOption>) => {
        onChange?.(opt ? opt.value : null);
      },
      [onChange],
    );

    return (
      <Select<SelectOption, false>
        ref={ref}
        instanceId={instanceId ?? inputId}
        inputId={inputId}
        aria-label={ariaLabel}
        options={normalizedOptions}
        getOptionValue={(option) => option.value}
        getOptionLabel={(option) => option.label}
        value={selectedOption}
        onChange={handleChange}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={isClearable}
        isSearchable
        hideSelectedOptions={false}
        styles={styles}
        className={cn("searchable-select", className)}
        classNamePrefix="ss"
        menuPosition={
          menuPositionProp ?? (menuPortalTarget ? "fixed" : "absolute")
        }
        menuPortalTarget={menuPortalTarget}
        components={STABLE_COMPONENTS}
        noOptionsMessage={() => "No options found"}
      />
    );
  },
);

SearchableSelect.displayName = "SearchableSelect";

export default SearchableSelect;
