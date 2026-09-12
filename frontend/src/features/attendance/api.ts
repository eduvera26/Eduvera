import { apiFetch } from "../../lib/api";

interface CopilotResponse {
  conversation_id: string;
  answer: string;
  provider: string;
}

function parseCopilotResponse(value: unknown): CopilotResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !("conversation_id" in value) ||
    typeof value.conversation_id !== "string" ||
    !("answer" in value) ||
    typeof value.answer !== "string" ||
    !value.answer.trim()
  ) {
    throw new TypeError("Attendance Copilot returned an invalid response.");
  }

  return {
    conversation_id: value.conversation_id,
    answer: value.answer,
    provider: "provider" in value && typeof value.provider === "string" ? value.provider : "unknown",
  };
}

export interface AskAttendanceCopilotOptions {
  question: string;
  studentId?: string;
  conversationId?: string;
}

export async function askAttendanceCopilot({
  question,
  studentId,
  conversationId,
}: AskAttendanceCopilotOptions): Promise<string> {
  const payload = await apiFetch<unknown>("/api/v1/ai/attendance/query/", {
    method: "POST",
    body: JSON.stringify({
      question,
      ...(studentId ? { student_id: studentId } : {}),
      ...(conversationId ? { conversation_id: conversationId } : {}),
    }),
  });

  return parseCopilotResponse(payload).answer;
}
