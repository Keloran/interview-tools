"use client";

import {useState} from "react";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {CopyButton} from "@/components/AvailabilityLinks";
import {MessageContext, TemplateId, TEMPLATES} from "@/lib/messages";

const dateFmt = new Intl.DateTimeFormat(undefined, {weekday: "long", day: "numeric", month: "long"});

// Pick a message, tweak it, copy it. Picking another template starts again from its wording.
export default function SendMessage({templates, context}: {
  templates: TemplateId[];
  context: Omit<MessageContext, "formatDate">;
}) {
  const render = (id: TemplateId) => TEMPLATES[id].render({...context, formatDate: (d) => dateFmt.format(d)});
  const [template, setTemplate] = useState(templates[0]);
  const [text, setText] = useState(() => render(templates[0]));

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <Label htmlFor="message-template">Message</Label>
        <Select
          value={template}
          onValueChange={(v) => {
            setTemplate(v as TemplateId);
            setText(render(v as TemplateId));
          }}
        >
          <SelectTrigger id="message-template" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templates.map((id) => <SelectItem key={id} value={id}>{TEMPLATES[id].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message to send" />
      <div>
        <CopyButton text={text} label="Copy message" />
      </div>
    </div>
  );
}
