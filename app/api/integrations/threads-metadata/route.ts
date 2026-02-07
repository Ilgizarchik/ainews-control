import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { accessToken } = await req.json();

        if (!accessToken) {
            return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
        }

        // Делаем запрос от имени сервера (Node.js)
        const res = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`, {
            next: { revalidate: 0 } // Не кэшируем
        });

        const data = await res.json();

        if (data.error) {
            console.error('[API/Threads] Meta Error:', data.error);
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('[API/Threads] Server Error:', error.message);
        return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
    }
}
