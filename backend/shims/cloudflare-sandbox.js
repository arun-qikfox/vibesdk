class Sandbox {
    async exec() {
        return { exitCode: 0, stdout: '', stderr: '' };
    }

    async readFile() {
        return { content: '' };
    }

    async writeFile() {
        return { success: true };
    }
}

module.exports = { Sandbox };
