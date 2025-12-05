export const runtime = 'edge';

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";

const FILE_KEY = "barrage.json";

export async function GET() {
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: FILE_KEY,
        });

        try {
            const response = await r2Client.send(command);
            const str = await response.Body?.transformToString();
            const data = str ? JSON.parse(str) : [];
            return NextResponse.json(data);
        } catch (e: any) {
            if (e.name === "NoSuchKey") {
                return NextResponse.json([]);
            }
            throw e;
        }
    } catch (error) {
        console.error("Failed to fetch barrage from R2:", error);
        return NextResponse.json([]);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, content, created_at } = body;

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        // 1. Fetch existing
        let currentdata: any[] = [];
        try {
            const getCommand = new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: FILE_KEY,
            });
            const response = await r2Client.send(getCommand);
            const str = await response.Body?.transformToString();
            if (str) {
                currentdata = JSON.parse(str);
            }
        } catch (e: any) {
            if (e.name !== "NoSuchKey") {
                console.error("Error fetching existing barrage:", e);
            }
        }

        // 2. Prepend new message
        const newMessage = {
            id,
            content,
            created_at: created_at || new Date().toISOString()
        };

        // Add to front
        const updatedData = [newMessage, ...currentdata];

        // 3. Truncate to 100
        const limitedData = updatedData.slice(0, 100);

        // 4. Upload back to R2
        const putCommand = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: FILE_KEY,
            Body: JSON.stringify(limitedData),
            ContentType: "application/json",
        });

        await r2Client.send(putCommand);

        return NextResponse.json({ success: true, count: limitedData.length });

    } catch (error) {
        console.error("Failed to post barrage:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
