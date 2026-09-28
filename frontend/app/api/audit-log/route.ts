import { NextResponse } from "next/server"; import { auditLogs } from "@/lib/server-store"; import { requireAdmin } from "@/lib/auth-server";
export async function GET(){try{requireAdmin();return NextResponse.json({data:auditLogs})}catch{return NextResponse.json({message:"Unauthorized"},{status:401})}}
