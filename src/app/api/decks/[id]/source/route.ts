import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkOrigin } from "@/lib/csrf";
import { isValidObjectId } from "@/lib/validation";
import { deleteDeckSourceText } from "@/lib/services/deck-source";

/**
 * DELETE /api/decks/[id]/source
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }
  const result = await deleteDeckSourceText(id, session.sub);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: "Source text permanently deleted. File name is retained for slide citations.",
  });
}
