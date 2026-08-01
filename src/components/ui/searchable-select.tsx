"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Option = { value: string; label: string; group?: string };

type Props = {
  options: Option[];
  value?: string;
  onChange: (value: string | undefined) => void;
  allLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  width?: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  allLabel = "All",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  width = "w-48",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const hasGroups = options.some((o) => o.group);
  const groupedOptions = hasGroups
    ? options.reduce<Map<string, Option[]>>((map, option) => {
        const key = option.group ?? "";
        const bucket = map.get(key) ?? [];
        bucket.push(option);
        map.set(key, bucket);
        return map;
      }, new Map())
    : null;

  function renderItem(option: Option) {
    return (
      <CommandItem
        key={option.value}
        value={option.label}
        onSelect={() => {
          onChange(option.value === value ? undefined : option.value);
          setOpen(false);
        }}
      >
        <Check
          className={cn(
            "w-4 h-4 mr-2",
            value === option.value ? "opacity-100" : "opacity-0"
          )}
        />
        {option.label}
      </CommandItem>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(width, "justify-between font-normal")}
        >
          <span className="truncate">
            {selected ? selected.label : allLabel}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {/* "All" option — always at the top, ungrouped */}
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "w-4 h-4 mr-2",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                {allLabel}
              </CommandItem>
              {!groupedOptions && options.map(renderItem)}
            </CommandGroup>
            {groupedOptions &&
              [...groupedOptions.entries()].map(([groupName, opts]) => (
                <CommandGroup
                  key={groupName || "__ungrouped__"}
                  heading={groupName || undefined}
                >
                  {opts.map(renderItem)}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}