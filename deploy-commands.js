const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// コマンドの定義
const commands = [
    // /join
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('ボイスチャンネルに参加します'),

    // /leave
    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('ボイスチャンネルから退出します'),

    // /voice [character]
    new SlashCommandBuilder()
        .setName('voice')
        .setDescription('読み上げ音声(キャラクター)を変更します')
        .addStringOption(option =>
            option.setName('character')
                .setDescription('キャラクター名(ずんだもん，めたんなど)')
                .setRequired(true) // 必須にする
        ),

    // /add [word] [reading]
    new SlashCommandBuilder()
        .setName('add')
        .setDescription('辞書に単語を登録します')
        .addStringOption(option =>
            option.setName('word')
                .setDescription('登録したい単語')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reading')
                .setDescription('読み方(ひらがな)')
                .setRequired(true)
        ),
];

// JSON形式に変換
const commandsData = commands.map(command => command.toJSON());

// 通信準備
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// 登録実行
(async () => {
    try {
        console.log('スラッシュコマンドの登録を開始します');

        if (process.env.GUILD_ID) {
            // 特定のサーバーのみ即時反映(開発用)
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commandsData },
            );
            console.log('✅ サーバー専用コマンドとして登録しました!(即時反映)');
        } else {
            // 全サーバーに登録(反映に時間がかかる)
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commandsData },
            );
            console.log('✅ グローバルコマンドとして登録しました!');
        }
    } catch (error) {
        console.error('❌ 登録エラー: ', error);
    }
})();
