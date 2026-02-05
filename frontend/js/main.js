import { getRandomPuzzle } from './puzzles.js';

class TurtleSoupGame {
    constructor() {
        this.currentPuzzle = null;
        this.chatBox = document.getElementById('chat-box');
        this.questionText = document.getElementById('question-text');
        this.guessInput = document.getElementById('guess-input');
        this.sendBtn = document.getElementById('send-btn');
    }

    async startNewGame() {
        this.currentPuzzle = getRandomPuzzle();
        this.questionText.textContent = this.currentPuzzle.question;
        this.clearChat();
        this.addMessage('AI 司机', '游戏开始！请提出你的问题。', 'ai');
        this.guessInput.focus();
    }

    async sendGuess() {
        const guess = this.guessInput.value.trim();
        if (!guess) return;

        this.addMessage('你', guess, 'user');
        this.guessInput.value = '';
        this.sendBtn.disabled = true;

        if (guess.includes('结束')) {
            this.addMessage('AI 司机', `真相大白：${this.currentPuzzle.answer}`, 'ai');
            this.sendBtn.disabled = false;
            return;
        }

        try {
            const response = await fetch('/api/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: this.currentPuzzle.question,
                    answer: this.currentPuzzle.answer,
                    guess: guess
                })
            });

            const data = await response.json();
            this.addMessage('AI 司机', data.reply, 'ai');
        } catch (error) {
            this.addMessage('AI 司机', '网络错误，请检查控制台。', 'ai');
        } finally {
            this.sendBtn.disabled = false;
        }
    }

    addMessage(sender, message, type) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `<strong>${sender}:</strong> ${message}`;
        this.chatBox.appendChild(div);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    clearChat() {
        this.chatBox.innerHTML = '';
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new TurtleSoupGame();
    window.game = game; // 挂载到全局，供HTML调用

    // 绑定按钮事件
    document.getElementById('new-game-btn').addEventListener('click', () => game.startNewGame());
    document.getElementById('send-btn').addEventListener('click', () => game.sendGuess());
    document.getElementById('guess-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') game.sendGuess();
    });

    // 页面加载后自动开始游戏
    game.startNewGame();
});