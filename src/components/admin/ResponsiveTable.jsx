import React from "react";
import { useLanguage } from "@/i18n/LanguageContext";
const text = (node) =>
  typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(text).join("")
      : React.isValidElement(node)
        ? text(node.props.children)
        : "";
export default function ResponsiveTable({ children, ...props }) {
  const { t } = useLanguage();
  const parts = React.Children.toArray(children);
  const head = parts.find((part) => part.type === "thead");
  const row = React.Children.toArray(head?.props.children)[0];
  const labels = React.Children.toArray(row?.props.children).map((cell) =>
    t(text(cell) || "Actions"),
  );
  return (
    <table {...props}>
      {parts.map((part) =>
        part.type !== "tbody"
          ? part
          : React.cloneElement(
              part,
              {},
              React.Children.map(part.props.children, (row) =>
                React.isValidElement(row)
                  ? React.cloneElement(
                      row,
                      {},
                      React.Children.map(row.props.children, (cell, i) =>
                        React.isValidElement(cell)
                          ? React.cloneElement(
                              cell,
                              { "data-label": labels[i] },
                              <div className="admin-cell">
                                {cell.props.children}
                              </div>,
                            )
                          : cell,
                      ),
                    )
                  : row,
              ),
            ),
      )}
    </table>
  );
}
