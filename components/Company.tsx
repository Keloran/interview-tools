"use client"

import {CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList,} from "@/components/ui/command"
import {useUser} from "@clerk/nextjs";
import {useQuery} from "@tanstack/react-query";
import {useState} from "react";
import {Input} from "@/components/ui/input";
import {Search} from "lucide-react";
import {useAppStore} from "@/lib/store";
import {useFlags} from "@flags-gg/react-library";

interface Company {
  name: string;
  id: number;
}

async function getCompanies() {
  const res = await fetch(`/api/companies`, {
    method: "GET",
  })

  if (!res.ok) {
    throw new Error("Failed to fetch companies from client")
  }

  return await res.json() as Company[];
}

export function Companies() {
  const {user} = useUser()
  const {is} = useFlags()
  const [searchOpen, setSearchOpen] = useState(false)
  const setFilteredCompany = useAppStore((s) => s.setFilteredCompany)

  const handleCompanyFilter = (name: string) => {
    if (name !== "") {
      setFilteredCompany(name)
    }
  }

  const {data} = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: getCompanies,
    enabled: !!user?.id,
  })

  if (!user) {
    return null
  }

  if (is("companies list").disabled()) {
    return null
  }

  return (
    <div className={"relative ml-auto flex-1 md:grow-0"}>
      <div onClick={() => setSearchOpen(true)}>
        <Search className={"absolute left-2.5 top-3 h-4 w-5 text-muted-foreground"} />
        <Input type={"search"} placeholder={"Companies Talked To"} className={"w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"} />
      </div>
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>You haven&apos;t done anything with this company.</CommandEmpty>
          {data?.map((company) => (
            <CommandItem
              className={"cursor-pointer p-2"}
              key={company.id}
              onSelect={() => {
                handleCompanyFilter(company.name)
                setSearchOpen(false)
              }}>{company.name}</CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  )
}
