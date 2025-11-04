class EmailMessage {
	constructor(options = {}) {
		this.options = { ...options };
		this.recipients = [];
		this.headers = new Map();
	}

	setFrom(address) {
		this.options.from = address;
	}

	setSubject(subject) {
		this.options.subject = subject;
	}

	setReplyTo(address) {
		this.options.replyTo = address;
	}

	addRecipient(address) {
		this.recipients.push(address);
	}

	addHeader(name, value) {
		this.headers.set(name, value);
	}

	setContent(content) {
		this.options.content = content;
	}

	async send() {
		console.warn('[cloudflare-email shim] EmailMessage.send() called; no email will be delivered.', {
			from: this.options.from,
			to: this.recipients.length > 0 ? this.recipients : this.options.to,
			subject: this.options.subject,
		});
		return { success: false, simulated: true };
	}
}

module.exports = {
	EmailMessage,
};
