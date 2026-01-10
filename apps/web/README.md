# Atlas: Argo Data Visualization Platform

<a href="https://youtu.be/N9W8DbJOrOA" target="_blank">
  <img width="1852" height="1003" alt="atlas_herov2" 
       src="https://github.com/user-attachments/assets/4fa51e46-fbb1-4196-8047-67e049ae394c" />
</a>

A comprehensive prototype platform for visualizing Argo float data with integrated AI capabilities, developed for the Indian National Centre for Ocean Information Services (INCOIS), Government of India under SIH.

## About INCOIS

The Indian National Centre for Ocean Information Services [(INCOIS)](https://incois.gov.in/site/index.jsp) is an autonomous organization under the Ministry of Earth Sciences, Government of India. INCOIS provides ocean information and advisory services to support the blue economy, sustainable development, and marine safety.

## Features

### Data Visualization

- **Interactive Argo Float Maps**: Real-time visualization of Argo float deployments and trajectories
- **Oceanographic Profiles**: Temperature, salinity, and other parameter profiles
- **Trajectory Analysis**: Animated trajectories with time-based filtering
- **Multi-parameter Charts**: Comprehensive data analysis with interactive charts

### AI Integration

- **Intelligent Chat Interface**: AI-powered queries about ocean data and patterns
- **Data Insights**: Automated analysis and pattern recognition
- **Natural Language Processing**: Query ocean data using conversational language

### Advanced Analytics

- **Time Period Selection**: Flexible temporal filtering of ocean data
- **Deployment Year Filtering**: Historical analysis capabilities
- **Data Download**: Export capabilities for research and analysis
- **Battery Monitoring**: Real-time monitoring of float battery status

## Technology Stack

### Frontend

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component library

### Mapping & Visualization

- **Leaflet & Mapbox**: Interactive mapping capabilities
- **D3.js**: Data-driven document manipulation
- **Recharts & Plotly**: Advanced charting libraries
- **React-Leaflet**: React integration for Leaflet maps
  
<img width="2321" height="1612" alt="ocen v2_crop" src="https://github.com/user-attachments/assets/04eebd8e-7838-42c1-b794-39bdcc873484" />

### AI & Data Processing

- **Groq AI**: Fast inference for AI queries
- **Google Generative AI**: Advanced language models
- **Qdrant**: Vector database for semantic search
- **AI SDK**: Unified AI integration

### Development Tools

- **Biome**: Fast linter and formatter
- **shadcn/ui**: Modern UI components
- **Zustand**: State management

## Prerequisites

- Node.js 18+
- pnpm, npm, yarn, or bun package manager
- Git

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Itz-Agasta/Atlas.git
   cd ocen-proto
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   # or
   npm install
   # or
   yarn install
   # or
   bun install
   ```

3. **Environment Setup**
   Create a `.env.local` file with required API keys:

   ```env
   GROQ_API_KEY=your_groq_api_key
   GOOGLE_AI_API_KEY=your_google_ai_api_key
   QDRANT_URL=your_qdrant_url
   QDRANT_API_KEY=your_qdrant_api_key
   ```

4. **Run the development server**

   ```bash
   pnpm dev
   # or
   npm run dev
   # or
   yarn dev
   # or
   bun dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### For Researchers & Scientists

1. **Explore Float Data**: Use the interactive map to browse Argo float deployments
2. **Analyze Profiles**: View detailed oceanographic profiles for specific floats
3. **Track Trajectories**: Monitor float movements over time with animated visualizations
4. **Query with AI**: Ask questions about ocean patterns and data insights

### For Data Analysts

1. **Filter Data**: Use time period and deployment year filters
2. **Download Datasets**: Export data for further analysis
3. **Generate Reports**: Utilize AI insights for comprehensive reporting

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes for AI and data services
│   ├── float/[id]/        # Individual float profile pages
│   └── trajectory/[id]/   # Trajectory visualization pages
├── components/            # Reusable React components
│   ├── home/             # Homepage components
│   ├── profile/          # Float profile components
│   └── Trajectory/       # Trajectory visualization components
├── data/                 # Mock data and sample datasets
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
└── types/                # TypeScript type definitions
```

## Development

### Code Quality

```bash
# Lint code
pnpm lint

# Format code
pnpm format
```

### Building for Production

```bash
pnpm build
pnpm start
```

## Acknowledgments

- Argo Program for providing ocean data
- Ministry of Earth Sciences, Government of India
- Open source community for the amazing tools and libraries
- Smart India Hackathon for the opportunity
