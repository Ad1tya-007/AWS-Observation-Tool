# AWS Observation tool

A **desktop app for observing what is happening in your AWS environment**—starting with **Amazon CloudWatch logs**. It helps engineers see errors, slow calls, and how requests flow across services, without sending data to a separate SaaS product.

The app runs **locally on macOS**, uses your **existing AWS CLI profiles** (including SSO), and keeps fetched logs **in memory only**—nothing is persisted to disk or sent to a custom backend.

## What it does

- **Connects to AWS** using the same credentials you already use on the command line.
- **Pulls logs** from CloudWatch for log groups and time ranges you choose.
- **Groups activity** into requests when IDs like `requestId` or trace IDs appear in the logs.
- **Surfaces problems**: errors, HTTP 5xx responses, slow APIs, retries, and timeouts.
- **Shows a timeline** of how operations unfolded across services for a single request.
- **Optional local AI** (via [Ollama](https://ollama.com/)) to summarize failures and suggest fixes—runs on your machine, not in the cloud. ( Not done yet )

In short: it is an **observation and debugging companion** for distributed systems on AWS, not only a raw log viewer.

## Tech stack

| Layer         | Technology                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Desktop shell | [Tauri](https://tauri.app/)                                                                               |
| UI            | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| Backend / AWS | [Rust](https://www.rust-lang.org/) with the AWS SDK for CloudWatch Logs                                   |

## Development

**Prerequisites:** Node.js, Rust, and the Tauri prerequisites for your OS.

```bash
npm install
npm run tauri dev
```

For editor setup, [VS Code](https://code.visualstudio.com/) with the [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) extensions works well.
