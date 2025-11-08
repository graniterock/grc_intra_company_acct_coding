import { NextResponse } from "next/server";
import {
  validateAccountCodes as validateAccountCodesFromDb,
  type AccountCodeValidationResult,
} from "@/lib/sql-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidateRequestBody = {
  codes?: unknown;
};

const normalizeCode = (value: string): string => value.trim().toUpperCase();

export async function POST(request: Request) {
  let body: ValidateRequestBody;

  try {
    body = (await request.json()) as ValidateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.codes)) {
    return NextResponse.json(
      { error: "Request body must include a 'codes' array." },
      { status: 400 }
    );
  }

  const normalizedCodes = new Set<string>();

  for (const entry of body.codes) {
    if (typeof entry !== "string") {
      return NextResponse.json(
        { error: "All account codes must be strings." },
        { status: 400 }
      );
    }

    const normalized = normalizeCode(entry);
    if (normalized.length === 0) {
      continue;
    }
    normalizedCodes.add(normalized);
  }

  try {
    const dbResults = await validateAccountCodesFromDb(
      Array.from(normalizedCodes)
    );

    const resultMap = new Map<string, AccountCodeValidationResult>();
    dbResults.forEach((result) => {
      resultMap.set(result.code, result);
    });

    const results: AccountCodeValidationResult[] = [];

    normalizedCodes.forEach((code) => {
      const match = resultMap.get(code);
      if (match) {
        results.push(match);
        return;
      }

      results.push({
        code,
        isValid: false,
        taskDesc: "",
        acctDesc: "",
      });
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Account code validation failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to validate account codes.";
    const responseMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to validate account codes."
        : message;
    return NextResponse.json({ error: responseMessage }, { status: 500 });
  }
}
