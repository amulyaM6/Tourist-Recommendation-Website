# Tourist Recommendation Platform

A full-stack travel recommendation web platform that suggests destinations based on user preferences like duration, traveller type, budget, and interests.

## Features

- Elegant frontend landing page with interactive preference form
- Backend recommendation API with weighted matching logic
- Destination dataset with rich metadata
- Feedback API for user ratings
- Insights API for top-rated destinations and usage tracking
- Persistent local storage for searches and ratings

## Project Structure

- `index1.html` - frontend UI
- `server.js` - Express server + API routes
- `src/recommender.js` - recommendation engine
- `data/destinations.json` - destination catalog
- `data/store.json` - persisted searches and feedback

## Quick Start

1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Open:
   - [http://localhost:3000](http://localhost:3000)

## API Endpoints

- `GET /api/health` - service status
- `GET /api/destinations` - full destination list
- `POST /api/recommendations` - get personalized recommendations
- `POST /api/feedback` - submit destination rating
- `GET /api/insights` - usage and top-rated insights

### Recommendations Request Body

```json
{
  "duration": "Short trip (4–7 days)",
  "traveller": "Couple",
  "budget": "Mid-range (comfortable)",
  "interests": ["food & local cuisine", "history & culture"],
  "extras": "Vegetarian options preferred"
}
```

## Notes

- Recommendation logic is deterministic and does not require external AI APIs.
- You can extend `data/destinations.json` with more destinations to improve variety.
