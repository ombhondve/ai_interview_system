import { NextResponse } from "next/server"; import { getReports } from "@/lib/server-store"; import { requireAdmin } from "@/lib/auth-server";
export async function GET(){try{requireAdmin();return NextResponse.json({data:getReports()})}catch{return NextResponse.json({message:"Unauthorized"},{status:401})}}
