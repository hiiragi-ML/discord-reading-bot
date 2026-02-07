import { createAudioPlayer, createAudioResource, StreamType, VoiceConnection, AudioPlayerStatus, AudioPlayer } from '@discordjs/voice';
import { Readable } from 'stream';
import * as googleTTS from 'google-tts-api';

// キューシステムの状態管理
const audioQueue: Buffer[] = [];
let isPlaying = false;
let player: AudioPlayer | null = null;

// キューを処理して再生する関数
function processQueue(connection: VoiceConnection){
    if(isPlaying || audioQueue.length === 0) return;

    isPlaying = true;
    const nextBuffer = audioQueue.shift();

    if(!nextBuffer){
        isPlaying = false;
        return;
    }

    if(!player){
        player = createAudioPlayer();
        player.on(AudioPlayerStatus.Idle, () => {
            isPlaying = false;
            processQueue(connection);
        });
        player.on('error', error => {
            console.error('再生エラー: ', error);
            isPlaying = false;
            processQueue(connection);
        });
        connection.subscribe(player);
    }

    const stream = Readable.from(nextBuffer);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    player.play(resource);
}

// メイン関数
export async function playGoogleTTS(text: string, connection: VoiceConnection): Promise<void> {
    if(!text) return;

    try{
        // google-tts-apiは200文字制限があるが
        // getAllAudioBase64を使うと自動で分割
        const results = await googleTTS.getAllAudioBase64(text, {
            lang: 'ja',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        // 取得したBase64音声をバッファに変換してキューに追加
        for(const base64 of results){
            const buffer = Buffer.from(base64.base64, 'base64');
            audioQueue.push(buffer);
        }

        // 再生開始
        processQueue(connection);
    }catch (error){
        console.error('Google TTS エラー: ', error);
    }
}
