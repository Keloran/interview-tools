"use client";

import {useSyncExternalStore} from "react";
import {Download, Smartphone} from "lucide-react";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";

export const APP_STORE_URL = "https://apps.apple.com/gb/app/interviews-tool/id6756259187";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=tools.interviews.android";

function getPlatform() {
  const {userAgent, maxTouchPoints} = navigator;
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

// Platform information is stable for the page lifetime. A server fallback keeps hydration consistent.
const subscribe = () => () => {};
const getServerPlatform = () => "other";

export default function AppStoreLink() {
  const platform = useSyncExternalStore(subscribe, getPlatform, getServerPlatform);
  const content = <><Download aria-hidden="true" /><span className="hidden sm:inline">Get the app</span></>;
  const className = "size-9 p-0 sm:h-9 sm:w-auto sm:px-3";

  if (platform !== "other") {
    const label = platform === "ios" ? "Get the app on the App Store" : "Get the app on Google Play";
    return <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" className={className}>
          <a href={platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL} aria-label={label}>{content}</a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>;
  }

  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" className={className} aria-label="Get the app">{content}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem asChild><a href={APP_STORE_URL}><Smartphone aria-hidden="true" />App Store for iPhone and iPad</a></DropdownMenuItem>
      <DropdownMenuItem asChild><a href={PLAY_STORE_URL}><Smartphone aria-hidden="true" />Google Play for Android</a></DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
