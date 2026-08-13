export interface WeatherSnapshot {
  location: {
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    observedAt: string;
    temperature: number | null;
    feelsLike: number | null;
    humidity: number | null;
    conditions: string | null;
    windSpeed: number | null;
    visibility: number | null;
    uvIndex: number | null;
  };
  units: 'metric' | 'us' | 'uk';
}

export interface WeatherProvider {
  getCurrentWeather(location: string): Promise<WeatherSnapshot>;
}

export class LocationNotFoundError extends Error {
  constructor(location: string) {
    super(`No weather data was found for "${location}".`);
    this.name = 'LocationNotFoundError';
  }
}

export class UpstreamServiceError extends Error {
  constructor(message = 'The weather provider is temporarily unavailable.') {
    super(message);
    this.name = 'UpstreamServiceError';
  }
}
