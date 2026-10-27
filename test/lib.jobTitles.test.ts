import {describe, expect, it} from "vitest";
import {jobTitlesMatch, normalizeJobTitle} from "@/lib/jobTitles";

describe("normalizeJobTitle", () => {
  it.each([
    ["Sr. Software Engineer", "senior software engineer"],
    ["Snr Software Eng.", "senior software engineer"],
    ["Jr. Software Dev.", "junior software engineer"],
    ["Senior Software Developer", "senior software engineer"],
    ["  BACK-END   Developer (m/f/d) - Remote  ", "backend engineer"],
    ["Front End Engineer", "frontend engineer"],
    ["Full–Stack Engineer (Remote)", "fullstack engineer"],
    ["Senior—Software—Engineer", "senior software engineer"],
    ["Remote Sensing Engineer", "remote sensing engineer"],
    ["C++ / C# / .NET Developer", "c++ / c# / .net engineer"],
    ["", ""],
    ["   ", ""],
  ])("normalizes %j", (title, expected) => {
    expect(normalizeJobTitle(title)).toBe(expected);
  });
});

describe("jobTitlesMatch", () => {
  it.each([
    ["Sr. Software Engineer", "Senior Software Engineer"],
    ["Backend Engineer", "Back-end Developer"],
    ["Jr Dev", "Junior Engineer (m/f/d) - Remote"],
    ["Frontend Developer", "Front-end Eng"],
    ["Full Stack Dev", "Fullstack Engineer"],
    ["Software Developer", "Senior Software Engineer"],
  ])("matches %j with %j in both directions", (first, second) => {
    expect(jobTitlesMatch(first, second)).toBe(true);
    expect(jobTitlesMatch(second, first)).toBe(true);
  });

  it.each([
    ["Senior Engineer", "Engineering Manager"],
    ["Engineer", "Engineering Manager"],
    ["Java Developer", "JavaScript Developer"],
    ["Senior Engineer", "Junior Engineer"],
    ["C++ Developer", "C Developer"],
    ["C# Developer", "C Developer"],
    ["", "Engineer"],
    ["Engineer", "(m/f/d) - Remote"],
    ["", ""],
  ])("does not match %j with %j in either direction", (first, second) => {
    expect(jobTitlesMatch(first, second)).toBe(false);
    expect(jobTitlesMatch(second, first)).toBe(false);
  });
});
