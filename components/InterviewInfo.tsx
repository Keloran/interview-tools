"use client"

import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";

export default function InterviewInfo(props: {interviewId: string | null}) {
  if (typeof props.interviewId === 'string' && props.interviewId.startsWith('guest_')) {

  }
  const user = useUser();

  // Fetch interview data if interviewId is provided
  const { data: interviewData } = useQuery({
    queryKey: ["interview", props.interviewId],
    queryFn: async () => {
      if (!props.interviewId) return null;
      const res = await fetch(`/api/interview/${props.interviewId}`);
      if (!res.ok) throw new Error("Failed to fetch interview");
      return await res.json();
    },
    enabled: !!props.interviewId && !!user,
  });

  console.info("interviewData", interviewData);

  return <></>
}