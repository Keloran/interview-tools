import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {Prisma} from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import {POST} from "@/app/api/native/follow-ups/route";
const identity="11111111-1111-4111-8111-111111111111";
const result={id:2,sentAt:new Date("2026-01-01T12:00:00Z")};
const request=(body:unknown)=>new NextRequest("https://interviews.tools/api/native/follow-ups",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{
 vi.resetAllMocks();vi.mocked(currentUser).mockResolvedValue({id:"user_123"} as any);
 vi.mocked(prisma.application.findFirst).mockResolvedValue({id:7} as any);
 vi.mocked(prisma.followUp.create).mockResolvedValue(result as any);
});
describe("native follow-up records",()=>{
 it("requires authentication and a valid identity",async()=>{
  vi.mocked(currentUser).mockResolvedValueOnce(null);
  expect((await POST(request({applicationId:7,clientMutationId:identity}))).status).toBe(401);
  expect((await POST(request({applicationId:7}))).status).toBe(400);
  expect((await POST(request({applicationId:7,clientMutationId:"bad"}))).status).toBe(400);
  expect(prisma.followUp.create).not.toHaveBeenCalled();
 });
 it("checks application ownership before reading or writing a receipt",async()=>{
  vi.mocked(prisma.application.findFirst).mockResolvedValue(null);
  expect((await POST(request({applicationId:7,clientMutationId:identity}))).status).toBe(404);
  expect(prisma.followUp.findUnique).not.toHaveBeenCalled();expect(prisma.followUp.create).not.toHaveBeenCalled();
 });
 it("persists the UUID on the owned application",async()=>{
  expect((await POST(request({applicationId:7,clientMutationId:identity.toUpperCase()}))).status).toBe(201);
  expect(prisma.followUp.create).toHaveBeenCalledWith(expect.objectContaining({data:{applicationId:7,clientMutationId:identity}}));
  expect(prisma.application.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:7,user:{clerkId:"user_123"}}}));
 });
 it("replays the original recorded time after a lost response",async()=>{
  vi.mocked(prisma.followUp.findUnique).mockResolvedValue(result as any);
  const response=await POST(request({applicationId:7,clientMutationId:identity}));
  expect(response.status).toBe(200);expect((await response.json()).sentAt).toBe(result.sentAt.toISOString());
  expect(prisma.followUp.create).not.toHaveBeenCalled();
 });
 it("resolves concurrent retries through the unique identity",async()=>{
  vi.mocked(prisma.followUp.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce(result as any);
  vi.mocked(prisma.followUp.create).mockRejectedValue(new Prisma.PrismaClientKnownRequestError("race",{code:"P2002",clientVersion:"test"}));
  expect((await POST(request({applicationId:7,clientMutationId:identity}))).status).toBe(200);
  expect(prisma.followUp.create).toHaveBeenCalledTimes(1);
 });
 it("cannot recreate a record on a deleted application",async()=>{
  vi.mocked(prisma.application.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.followUp.findUnique).mockResolvedValue(result as any);
  expect((await POST(request({applicationId:7,clientMutationId:identity}))).status).toBe(404);
  expect(prisma.followUp.findUnique).not.toHaveBeenCalled();
 });
});
