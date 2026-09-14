export function mapWeather(raw) {
  return {
    location: {
      city: raw.location.name,
      country: raw.location.country,
      localTime: raw.location.localtime,
    },
    current: {
      tempC: raw.current.temp_c,
      tempF: raw.current.temp_f,
      condition: raw.current.condition.text,
      icon: raw.current.condition.icon,
      humidity: raw.current.humidity,
      windKph: raw.current.wind_kph,
    },
    forecast: raw.forecast.forecastday.map((day) => ({
      date: day.date,
      maxTempC: day.day.maxtemp_c,
      maxTempF: day.day.maxtemp_f,
      minTempC: day.day.mintemp_c,
      minTempF: day.day.mintemp_f,
      condition: day.day.condition.text,
      icon: day.day.condition.icon,
      hours: day.day && day.hour.map((h) => ({
        time: h.time,
        tempC: h.temp_c,
        tempF: h.temp_f,
        condition: h.condition.text,
        icon: h.condition.icon,
      })),
    })),
  };
}

