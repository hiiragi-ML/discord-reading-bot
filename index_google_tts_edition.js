// 必要なクラスを読み込み
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
require('dotenv').config(); // .envファイルを読み込む

// クライアント(Bot)のインスタンスを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // サーバーに関する情報
        GatewayIntentBits.GuildMessages,    // メッセージに関する情報
        GatewayIntentBits.MessageContent,   // メッセージの内容に関する情報
        GatewayIntentBits.GuildVoiceStates, // ボイスチャンネルに関する情報
    ],
});

// Botが現在接続している「コネクション」を保存しておく場所
let connection = null;

// Botが起動したときに1回だけ実行
client.once('ready', () => {
    console.log(`${client.user.tag} landed now!`);
});

// messageが送信されたときに実行される
client.on('messageCreate', async (message) => {
    // Bot自身の発言は無視する
    if (message.author.bot) return;

    // 1. 「!join」コマンドでユーザーがいるボイスチャンネルに入る
    if (message.content === '!join') {
        if (message.member.voice.channel) {
            connection = joinVoiceChannel({
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            message.reply('ボイスチャンネルに参加しました！読み上げを開始します。');
        } else {
            message.reply('まずはあなたがボイスチャンネルに入ってください!');
        }
        return;
    }

    // 2. 「!leave」コマンドで，ボイスチャンネルから出る
    if (message.content === '!leave') {
        if (connection) {
            connection.destroy();
            connection = null;
            message.reply('読み上げを終了しました。');
        }
        return;
    }

    // 3. ボイスチャンネルに接続中なら，チャットを読み上げる
    if (connection) {
        // チャットのフィルタリングも可能

        // --- フィルタリング処理 ---
        // メンションをIDではなく名前に変換したテキストを取得
        let text = message.cleanContent;

        // 1. コマンドは読み上げない
        if (text.startsWith('!')) return;

        // 2. コードブロックを削除
        text = text.replace(/```[\s\S]*?```/g, '');

        // 3. URLをURLという言葉に書き換える
        text = text.replace(/https?:\/\/[^\s]+/g, 'URL');

        // 4. Discordのカスタム絵文字を削除
        text = text.replace(/<a?:.+?:\d+>/g, '');

        // 5. 空白を取り除いて，中身がなくなったら読み上げない
        if (!text.trim()) return;

        // 6. 文字数が多すぎる場合はかっとする
        if (text.length > 100) {
            text = text.substring(0, 100) + '，以下省略';
        }



        try {
            // テキストを音声データのURLに変換(日本語設定)
            const url = googleTTS.getAudioUrl(text, {
                lang: 'ja',
                slow: false,
                host: 'https://translate.google.com',
            });

            // プレイヤーを作成して再生
            const player = createAudioPlayer();
            const resource = createAudioResource(url);

            connection.subscribe(player);
            player.play(resource);
        } catch (error) {
            console.error(error);
        }
    }
});

// Botにログインする
client.login(process.env.DISCORD_TOKEN);
