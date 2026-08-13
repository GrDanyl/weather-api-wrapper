import {
  LocationNotFoundError,
  type WeatherProvider,
  type WeatherSnapshot,
  UpstreamServiceError,
} from '../domain/weather.js';

interface VisualCrossingResponse {
  resolvedAddress?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  currentConditions?: {
    datetimeEpoch?: number;
    temp?: number;
    feelslike?: number;
    humidity?: number;
    conditions?: string;
    windspeed?: number;
    visibility?: number;
    uvindex?: number;
  };
}

export class VisualCrossingProvider implements WeatherProvider {
  private readonly baseUrl = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';

  constructor(
    private readonly apiKey: string,
    private readonly unitSystem: WeatherSnapshot['units'],
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async getCurrentWeather(location: string): Promise<WeatherSnapshot> {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(location)}`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('unitGroup', this.unitSystem);
    url.searchParams.set('include', 'current');
    url.searchParams.set('contentType', 'json');

    let response: Response;
    try {
      response = await this.fetchImplementation(url, { signal: AbortSignal.timeout(8_000) });
    } catch {
      throw new UpstreamServiceError();
    }

    if (response.status === 400 || response.status === 404) {
      throw new LocationNotFoundError(location);
    }

    if (!response.ok) {
      throw new UpstreamServiceError();
    }

    let data: VisualCrossingResponse;
    try {
      data = (await response.json()) as VisualCrossingResponse;
    } catch {
      throw new UpstreamServiceError('The weather provider returned an invalid response.');
    }

    if (!data.resolvedAddress || data.latitude === undefined || data.longitude === undefined || !data.currentConditions) {
      throw new UpstreamServiceError('The weather provider returned incomplete weather data.');
    }

    const current = data.currentConditions;
    return {
      location: {
        name: data.resolvedAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone ?? 'UTC',
      },
      current: {
        observedAt: current.datetimeEpoch ? new Date(current.datetimeEpoch * 1_000).toISOString() : new Date().toISOString(),
        temperature: current.temp ?? null,
        feelsLike: current.feelslike ?? null,
        humidity: current.humidity ?? null,
        conditions: current.conditions ?? null,
        windSpeed: current.windspeed ?? null,
        visibility: current.visibility ?? null,
        uvIndex: current.uvindex ?? null,
      },
      units: this.unitSystem,
    };
  }
}
