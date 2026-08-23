# MinuteMind - Meeting Summarizer

MinuteMind turns meeting audio into a transcript and an action-oriented brief. It uses
Groq Cloud for Whisper speech-to-text and LLM summarization with a strict JSON schema for
the overview, key decisions, action items, and open questions.

## Features

- Drag-and-drop audio upload with file type and 25 MB size validation
- Speech-to-text transcription using `whisper-large-v3-turbo`
- Structured meeting summaries using `openai/gpt-oss-20b`
- Action items with an owner and due date, without inventing missing details
- Full transcript and reusable, copy-ready notes
- Local meeting history stored in `data/meetings.json`
- Responsive, keyboard-accessible frontend
- No third-party runtime packages

## Assignment coverage

| Requirement | Implementation |
| --- | --- |
| Meeting audio input | Browser upload for MP3, MP4, M4A, WAV, WEBM, MPEG, MPGA, OGG, and FLAC |
| Text transcript | Groq Speech-to-Text API with Whisper Large V3 Turbo |
| Summary and action items | Groq Chat Completions API with a strict meeting-summary schema |
| Backend processing and storage | Node.js HTTP backend and atomic local JSON persistence |
| Optional frontend | Responsive upload, results, transcript, and history interface |
| Effective LLM prompt | Grounded prompt that separates untrusted transcript content and forbids invented facts |
| GitHub repo and README | This repository and document |
| Demo video | Submitted separately with the assignment |

## Architecture

```text
Browser upload
     |
     v
Node.js backend -----> Groq Speech-to-Text API
     |                             |
     |                             v
     |                        Transcript
     |                             |
     +-----------------------------+
     |
     v
Groq Chat Completions API (strict JSON schema)
     |
     +----> Summary, decisions, action items, open questions
     |
     +----> Local JSON meeting history
```

The browser never receives the API key and audio files are not written to disk. Only the
transcript, generated summary, source filename, file metadata, and processing time are
stored locally.

## Requirements

- Node.js 20 or newer
- A free [Groq Cloud API key](https://console.groq.com/keys)

## Run locally

1. Clone the repository and enter its directory:

   ```bash
   git clone https://github.com/harshitha01092005/meeting-summarizer.git
   cd meeting-summarizer
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Replace `replace_with_your_api_key` in `.env` with your Groq API key.

4. Start the app:

   ```bash
   npm start
   ```

5. Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

No `npm install` step is needed because the application uses only Node.js built-ins.

## How to use

1. Optionally enter a meeting title.
2. Select or drop a supported audio file up to 25 MB.
3. Optionally provide names, acronyms, or domain vocabulary to improve transcription.
4. Select **Generate meeting notes**.
5. Review or copy the overview, decisions, action items, questions, and transcript.

Processing time depends on recording length and API response time. The Groq free plan is
sufficient for a short demo; requests are subject to its current rate limits.

## Prompt design

The summary prompt is in [`src/prompt.js`](src/prompt.js). It is intentionally designed to:

- treat the transcript as untrusted meeting content rather than instructions;
- prohibit invented decisions, owners, dates, and facts;
- use `Unassigned` and `Not specified` when details are missing;
- produce a strict schema so the interface always receives predictable fields;
- focus on decisions, commitments, and unresolved questions rather than generic prose.

Model names are configurable through `.env` without code changes.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server and API-key configuration status |
| `POST` | `/api/meetings` | Upload, transcribe, summarize, and persist a meeting |
| `GET` | `/api/meetings` | List locally stored meeting results |
| `GET` | `/api/meetings/:id` | Retrieve one stored meeting |

## Tests

Run the complete test suite:

```bash
npm test
```

Run syntax checks and tests together:

```bash
npm run check
```

The tests cover input validation, environment configuration, API request contracts,
structured-output parsing, error mapping, concurrent persistence, security headers,
static delivery, and the upload route. External API calls are mocked, so tests do not
use an API key or spend API credits.

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Yes | - | Secret Groq API key; never commit it |
| `PORT` | No | `3000` | Local HTTP port |
| `HOST` | No | `127.0.0.1` | Listening address |
| `GROQ_BASE_URL` | No | `https://api.groq.com/openai/v1` | Groq API base URL |
| `GROQ_TRANSCRIPTION_MODEL` | No | `whisper-large-v3-turbo` | Speech-to-text model |
| `GROQ_SUMMARY_MODEL` | No | `openai/gpt-oss-20b` | Summary model |
| `MAX_AUDIO_BYTES` | No | `26214400` | Maximum accepted audio size |
| `GROQ_TIMEOUT_MS` | No | `120000` | Upstream request timeout |

## Security and privacy

- `.env` and runtime meeting data are excluded from Git.
- API keys remain on the server and are never returned to the browser or logged.
- Upload type, extension, size, title length, and context length are validated.
- Request bodies are bounded even when the client omits `Content-Length`.
- Transcript text is rendered with safe DOM text nodes, not HTML.
- Responses include restrictive content security and browser hardening headers.

This is a local demonstration app, not a multi-user production service. For production,
use authenticated access, encrypted managed storage, retention controls, audit logging,
malware scanning, and user consent appropriate to local recording laws.

## Project structure

```text
meeting-summarizer/
├── public/                 # Frontend HTML, CSS, and JavaScript
├── src/                    # Backend, API client, prompt, validation, and storage
├── test/                   # Unit and HTTP integration tests
├── .env.example            # Safe configuration template
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## Limitations

- Speaker diarization is not included, so the transcript may not label individual speakers.
- Accuracy depends on audio quality, background noise, language, and domain vocabulary.
- The default 25 MB limit follows the app's configured upload boundary; longer recordings
  should be compressed or split before upload.
- Local JSON storage is intended for a single-user assignment demo.

## License

MIT
