# t3.consensus - Multi-LLM Consensus Engine

A web application that queries multiple AI language models with the same prompt and synthesizes their responses into a unified consensus view with comprehensive analytics.

## Features

- **Multi-Model Querying**: Query up to 10 different LLMs simultaneously (Claude, GPT-4, Gemini, DeepSeek, etc.)
- **Consensus Synthesis**: AI-powered synthesis of all model responses into a unified view
- **Interactive Analytics Dashboard**: Visual insights into model agreement, controversy, and behavioral patterns
- **Real-time Processing**: Progressive loading with visual feedback for each stage
- **Theme Explorer**: Search, filter, and sort consensus themes by strength, controversy, and impact
- **Model Behavior Analysis**: Understand how different models respond and relate to each other

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/your-username/t3-consensus.git
cd t3-consensus
```

2. Start a local server (required for ES6 modules):
```bash
python -m http.server 8000
# or
npx http-server
```

3. Open `http://localhost:8000/consensus.html` in your browser

4. Enter your OpenRouter API key when prompted (or set via console):
```javascript
localStorage.setItem('OPENROUTER_API_KEY', 'your-key-here')
```

## Usage

1. Enter your prompt in the text area
2. Select which models to query (3-6 recommended for best results)
3. Click "Process" to start the consensus generation
4. Explore the results in three sections:
   - **Outputs**: Individual model responses
   - **Consensus**: Synthesized consensus view with organized data
   - **Analytics**: Interactive dashboard with insights and visualizations

## Requirements

- Modern web browser with ES6 module support
- OpenRouter API key ([get one here](https://openrouter.ai))
- Internet connection for API calls

## Architecture

The project uses a modular ES6 architecture:
- `modules/app.js` - Main application coordinator
- `modules/config.js` - Configuration and model definitions
- `modules/api.js` - OpenRouter API integration
- `modules/consensus.js` - Consensus generation logic
- `modules/analytics.js` - Analytics and visualization
- `modules/ui.js` - User interface components

## License

This project is released into the public domain under The Unlicense. See the [LICENSE](LICENSE) file for details.

## Contributing

Feel free to fork, modify, and use this project for any purpose. Contributions are welcome!

## Acknowledgments

Built with vanilla JavaScript, HTML, and CSS. Uses [Marked.js](https://marked.js.org/) for Markdown parsing and [OpenRouter](https://openrouter.ai) for LLM access.
