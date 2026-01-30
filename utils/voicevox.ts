import axios from 'axios';
import { createAudioPlayer, createAudioResource, StreamType, VoiceConnection, AudioPlayerStatus, AudioPlayer, AudioResource } from '@discordjs/voice';
import { Readable } from 'stream';

const VOICEVOX_URL = 'http://127.0.0.1:50021';

// 1回の生成で処理する文字数
// 15~30位が目安
const CHUNK_SIZE = 20;

// 利用可能なキャラクターリスト
export const VOICE_MAP: Record<string, number> = {
    'ずんだもん': 3,
    'めたん': 2,
    'ずん子': 1,
    'つむぎ': 8,
    '雨晴': 10,
    '冥鳴': 14,
};

// 再生待ちの音声データをためておく場所
const audioQueue: Buffer[] = [];
// 現在再生中かどうか
let isPlaying = false;
// プレイヤーのインスタンス
let player: AudioPlayer | null = null;

// 音声データを生成するだけの関数
async function generateAudio(text: string, speakerId: number): Promise<Buffer | null> {
    try{
        const queryUrl = `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
        const queryRes = await axios.post(queryUrl, {});

        // 少し早口にしてラグを軽減
        // queryRes.data.speedScale = 1.3;

        const synthesisUrl = `${VOICEVOX_URL}/synthesis?speaker=${speakerId}`;
        const synthesisRes = await axios.post(synthesisUrl, queryRes.data, {
            responseType: 'arraybuffer'
        });
        return Buffer.from(synthesisRes.data);
    }catch (error){
        return null;
    }
}

// キューを消化して次々に再生する関数
function processQueue(connection: VoiceConnection){
    // すでに再生中，またはキューが空なら何もしない
    if (isPlaying || audioQueue.length === 0) return;

    isPlaying = true;
    const nextBuffer = audioQueue.shift(); // 先頭を取り出す

    if(!nextBuffer){
        isPlaying = false;
        return;
    }

    // プレイヤーがなければ作成
    if(!player){
        player = createAudioPlayer();

        // 再生が終わったら次を呼び出す
        player.on(AudioPlayerStatus.Idle, () => {
            isPlaying = false;
            processQueue(connection);
        });

        player.on('error', (error) => {
            console.error('再生エラー: ', error);
            isPlaying = false;
            processQueue(connection);
        });

        connection.subscribe(player);
    }

    // 再生リソースを作成して再生
    const stream = Readable.from(nextBuffer);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    player.play(resource);
}

// 文字列を指定の長さで分割する関数
function splitByLength(text: string, length: number): string[] {
    const chunks: string[] = [];
    for(let i = 0;i < text.length;i += length){
        chunks.push(text.slice(i, i + length));
    }
    return chunks;
}

// メイン関数
export async function playVoicevox(text: string, connection: VoiceConnection, speakerId: number): Promise<void> {
    if (!text) return;

    // テキストを文字数で分割
    const chunks = splitByLength(text, CHUNK_SIZE);

    // 分割した順に音声を生成してキューに入れる
    for(const chunk of chunks){
        // 音声生成
        const audioBuffer = await generateAudio(chunk, speakerId);

        if(audioBuffer){
            audioQueue.push(audioBuffer);

            processQueue(connection);
        }
    }
}
