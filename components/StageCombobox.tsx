"use client";

import {useState} from "react";
import {Check, ChevronsUpDown} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "@/components/ui/command";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {cn} from "@/lib/utils";

type Stage = { id: number; stage: string };

// Searchable stage picker; keeps the order it's given (process order from /api/stages)
export default function StageCombobox({id, stages, value, onChange, placeholder = "Choose…"}: {
  id: string;
  stages: Stage[] | undefined;
  value: string;
  onChange: (stage: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal cursor-pointer">
          <span className={cn(!value && "text-muted-foreground")}>{value || (stages ? placeholder : "Loading...")}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Search stages" />
          <CommandList>
            <CommandEmpty>No stage found.</CommandEmpty>
            <CommandGroup>
              {stages?.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.stage}
                  onSelect={() => {
                    onChange(s.stage);
                    setOpen(false);
                  }}
                >
                  {s.stage}
                  <Check className={cn("ml-auto", value === s.stage ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
