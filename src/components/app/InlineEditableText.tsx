"use client";

import React, { useRef, useEffect } from "react";
import { clsx } from "clsx";

export interface InlineEditableTextProps {
  value?: string | number | null;
  onChange?: (val: string) => void;
  onRemove?: () => void;
  editable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  onEmptyCommit?: "revert" | "remove";
}

export function InlineEditableText({
  value,
  onChange,
  onRemove,
  editable = false,
  className,
  style,
  as: Component = "span",
  multiline = false,
  placeholder,
  maxLength = 500,
  onEmptyCommit = "revert",
}: InlineEditableTextProps) {
  const textVal = value !== undefined && value !== null ? String(value) : "";
  const elementRef = useRef<HTMLElement | null>(null);

  // Keep DOM in sync with external value updates when not focused
  useEffect(() => {
    if (elementRef.current && document.activeElement !== elementRef.current) {
      elementRef.current.textContent = textVal;
    }
  }, [textVal]);

  if (!editable || !onChange) {
    return (
      <Component className={className} style={style}>
        {textVal || placeholder}
      </Component>
    );
  }

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    let newText = (e.currentTarget.textContent || "").trim();
    if (maxLength && newText.length > maxLength) {
      newText = newText.slice(0, maxLength);
      e.currentTarget.textContent = newText;
    }

    if (newText) {
      if (newText !== textVal) {
        onChange(newText);
      }
    } else {
      if (onEmptyCommit === "remove" && onRemove) {
        onRemove();
      } else {
        // Revert on empty commit
        e.currentTarget.textContent = textVal;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData("text/plain");
    if (!plainText) return;

    const selection = window.getSelection();
    const selectedLen = selection && !selection.isCollapsed ? selection.toString().length : 0;
    const currentText = e.currentTarget.textContent || "";
    let textToInsert = plainText;
    if (maxLength) {
      const effectiveLen = currentText.length - selectedLen;
      if (effectiveLen + plainText.length > maxLength) {
        const remaining = Math.max(0, maxLength - effectiveLen);
        textToInsert = plainText.slice(0, remaining);
      }
    }
    if (!textToInsert) return;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(textToInsert);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      document.execCommand("insertText", false, textToInsert);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      e.currentTarget.blur();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (elementRef.current) {
        elementRef.current.textContent = textVal;
      }
      e.currentTarget.blur();
      return;
    }

    // Enforce maxLength on typing unless it's a control/deletion key
    if (
      maxLength &&
      (e.currentTarget.textContent || "").length >= maxLength &&
      !e.ctrlKey &&
      !e.metaKey &&
      !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"].includes(e.key)
    ) {
      const selection = window.getSelection();
      // If there is no active text selection to replace, block new character
      if (!selection || selection.isCollapsed) {
        e.preventDefault();
      }
    }
  };

  return (
    <Component
      ref={elementRef as any}
      contentEditable={editable}
      suppressContentEditableWarning={true}
      onBlur={handleBlur}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      title="Click to edit text"
      className={clsx(
        className,
        "outline-none cursor-text rounded transition-all duration-150",
        "hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400/80 hover:bg-blue-500/5",
        "focus:outline focus:outline-2 focus:outline-[#2F5BFF] focus:bg-blue-500/10 focus:shadow-sm"
      )}
      style={style}
    >
      {textVal || placeholder}
    </Component>
  );
}

export default InlineEditableText;
