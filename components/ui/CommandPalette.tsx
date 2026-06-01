"use client";

import { Command } from "cmdk";
import { useEffect, useState, useCallback } from "react";

type CommandItem = {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
  group: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
};

export function CommandPalette({ open, onClose, items }: Props) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item) {
        item.action();
        onClose();
      }
    },
    [items, onClose]
  );

  if (!open) return null;

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <div className="tg-command-overlay" onClick={onClose} role="dialog" aria-label="Command palette">
      <div className="tg-command-container" onClick={(e) => e.stopPropagation()}>
        <Command label="Command palette" shouldFilter={true}>
          <Command.Input
            className="tg-command-input"
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <Command.List className="tg-command-list">
            <Command.Empty className="tg-command-empty">No results found.</Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group} heading={group} className="tg-command-group">
                {items
                  .filter((i) => i.group === group)
                  .map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => handleSelect(item.id)}
                      className="tg-command-item"
                    >
                      {item.icon && <span className="tg-command-item-icon">{item.icon}</span>}
                      <span className="tg-command-item-label">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="tg-command-kbd">{item.shortcut}</kbd>
                      )}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
