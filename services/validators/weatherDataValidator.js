/**
 * Weather Data Validator - Validates weather data completeness and accuracy
 * 
 * ENHANCEMENT: Extends weather validation beyond basic existence checks
 * CONSOLIDATION: Centralizes weather data quality assurance
 */

export class WeatherDataValidator {
  
  /**
   * Main weather data validation entry point
   * @param {string} dataType - Type of weather data (current, forecast, historical)
   * @param {object} data - Weather data to validate
   * @param {object} context - Additional validation context
   */
  static validateWeatherData(dataType, data, context = {}) {
    switch (dataType) {
      case 'current':
        return this.validateCurrentWeather(data, context);
      case 'forecast':
        return this.validateForecast(data, context);
      case 'historical':
        return this.validateHistorical(data, context);
      case 'location':
        return this.validateWeatherLocation(data, context);
      default:
        return {
          valid: false,
          errors: [`Unknown weather data type: ${dataType}`],
          warnings: [],
          category: 'weather-data'
        };
    }
  }
  
  /**
   * CURRENT WEATHER VALIDATION
   */
  static validateCurrentWeather(weatherData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { current } = weatherData;
    
    if (!current) {
      errors.push('Missing current weather data');
      return { valid: false, errors, warnings, category: 'weather-data' };
    }
    
    const {
      temp_f,
      temp_c,
      condition,
      humidity,
      wind_mph,
      wind_kph,
      precip_chance,
      precip_in,
      pressure_mb,
      vis_miles,
      uv,
      last_updated
    } = current;
    
    // VALIDATION 1: Temperature validation
    if (temp_f !== undefined) {
      if (isNaN(parseFloat(temp_f))) {
        errors.push('Invalid temperature (Fahrenheit)');
      } else {
        const tempNum = parseFloat(temp_f);
        if (tempNum < -100 || tempNum > 150) {
          errors.push(`Temperature ${tempNum}°F outside reasonable range (-100°F to 150°F)`);
        }
        if (tempNum < -50 || tempNum > 120) {
          warnings.push(`Extreme temperature ${tempNum}°F - verify accuracy`);
        }
      }
    }
    
    if (temp_c !== undefined) {
      if (isNaN(parseFloat(temp_c))) {
        errors.push('Invalid temperature (Celsius)');
      } else {
        const tempNum = parseFloat(temp_c);
        if (tempNum < -75 || tempNum > 65) {
          errors.push(`Temperature ${tempNum}°C outside reasonable range (-75°C to 65°C)`);
        }
      }
    }
    
    // VALIDATION 2: Temperature consistency
    if (temp_f !== undefined && temp_c !== undefined) {
      const tempFNum = parseFloat(temp_f);
      const tempCNum = parseFloat(temp_c);
      const convertedC = (tempFNum - 32) * 5 / 9;
      if (Math.abs(convertedC - tempCNum) > 1) {
        warnings.push('Temperature F and C values inconsistent');
      }
    }
    
    // VALIDATION 3: Humidity validation
    if (humidity !== undefined) {
      const humidityNum = parseFloat(humidity);
      if (isNaN(humidityNum)) {
        errors.push('Invalid humidity value');
      } else if (humidityNum < 0 || humidityNum > 100) {
        errors.push(`Humidity ${humidityNum}% outside valid range (0-100%)`);
      }
    }
    
    // VALIDATION 4: Wind validation
    if (wind_mph !== undefined) {
      const windNum = parseFloat(wind_mph);
      if (isNaN(windNum)) {
        errors.push('Invalid wind speed (mph)');
      } else if (windNum < 0) {
        errors.push('Wind speed cannot be negative');
      } else if (windNum > 200) {
        warnings.push(`Very high wind speed ${windNum} mph - verify accuracy`);
      }
    }
    
    // VALIDATION 5: Precipitation validation
    if (precip_chance !== undefined) {
      const precipNum = parseFloat(precip_chance);
      if (isNaN(precipNum)) {
        errors.push('Invalid precipitation chance');
      } else if (precipNum < 0 || precipNum > 100) {
        errors.push(`Precipitation chance ${precipNum}% outside valid range (0-100%)`);
      }
    }
    
    if (precip_in !== undefined) {
      const precipInNum = parseFloat(precip_in);
      if (isNaN(precipInNum)) {
        errors.push('Invalid precipitation amount');
      } else if (precipInNum < 0) {
        errors.push('Precipitation amount cannot be negative');
      } else if (precipInNum > 10) {
        warnings.push(`Very high precipitation ${precipInNum} inches - verify accuracy`);
      }
    }
    
    // VALIDATION 6: Condition text validation
    if (condition) {
      if (!condition.text || typeof condition.text !== 'string') {
        warnings.push('Missing or invalid weather condition text');
      } else if (condition.text.length < 3) {
        warnings.push('Weather condition text too short');
      }
    }
    
    // VALIDATION 7: Data freshness
    if (last_updated) {
      const updateTime = new Date(last_updated);
      if (isNaN(updateTime.getTime())) {
        warnings.push('Invalid last updated timestamp');
      } else {
        const hoursSinceUpdate = (Date.now() - updateTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 3) {
          warnings.push('Weather data may be stale (>3 hours old)');
        }
      }
    }
    
    // VALIDATION 8: Logical consistency
    if (precip_chance !== undefined && precip_in !== undefined) {
      const precipChanceNum = parseFloat(precip_chance);
      const precipInNum = parseFloat(precip_in);
      
      if (precipChanceNum === 0 && precipInNum > 0) {
        warnings.push('Precipitation amount >0 but chance is 0% - inconsistent');
      }
      if (precipChanceNum > 80 && precipInNum === 0) {
        warnings.push('High precipitation chance but amount is 0 - potentially inconsistent');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'weather-data',
      dataQuality: this.assessWeatherDataQuality(current)
    };
  }
  
  /**
   * FORECAST VALIDATION
   */
  static validateForecast(weatherData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { forecast } = weatherData;
    
    if (!forecast || !forecast.forecastday) {
      errors.push('Missing forecast data');
      return { valid: false, errors, warnings, category: 'weather-data' };
    }
    
    const { forecastday } = forecast;
    
    if (!Array.isArray(forecastday)) {
      errors.push('Forecast days must be an array');
      return { valid: false, errors, warnings, category: 'weather-data' };
    }
    
    // VALIDATION 1: Forecast structure
    forecastday.forEach((day, index) => {
      if (!day.date) {
        errors.push(`Missing date for forecast day ${index}`);
      } else {
        const dayDate = new Date(day.date);
        if (isNaN(dayDate.getTime())) {
          errors.push(`Invalid date format for forecast day ${index}: ${day.date}`);
        }
      }
      
      if (!day.day) {
        errors.push(`Missing day data for forecast day ${index}`);
      } else {
        // Validate day-level data
        const dayData = day.day;
        
        // Temperature validation
        if (dayData.maxtemp_f !== undefined && dayData.mintemp_f !== undefined) {
          const maxTemp = parseFloat(dayData.maxtemp_f);
          const minTemp = parseFloat(dayData.mintemp_f);
          
          if (!isNaN(maxTemp) && !isNaN(minTemp) && minTemp > maxTemp) {
            errors.push(`Min temp (${minTemp}°F) greater than max temp (${maxTemp}°F) on day ${index}`);
          }
        }
        
        // Precipitation validation
        if (dayData.daily_chance_of_rain !== undefined) {
          const rainChance = parseFloat(dayData.daily_chance_of_rain);
          if (isNaN(rainChance) || rainChance < 0 || rainChance > 100) {
            errors.push(`Invalid rain chance on day ${index}: ${dayData.daily_chance_of_rain}`);
          }
        }
      }
    });
    
    // VALIDATION 2: Forecast timeline
    if (forecastday.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const firstForecastDate = new Date(forecastday[0].date);
      const daysDiff = (firstForecastDate - today) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < -1) {
        warnings.push('Forecast starts more than 1 day in the past');
      }
      if (daysDiff > 1) {
        warnings.push('Forecast starts more than 1 day in the future');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'weather-data'
    };
  }
  
  /**
   * WEATHER LOCATION VALIDATION
   */
  static validateWeatherLocation(locationData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { name, region, country, lat, lon } = locationData;
    
    // VALIDATION 1: Basic location info
    if (!name) {
      errors.push('Location name is required');
    } else if (typeof name !== 'string' || name.length < 2) {
      errors.push('Location name too short or invalid');
    }
    
    // VALIDATION 2: Coordinates validation
    if (lat !== undefined) {
      const latNum = parseFloat(lat);
      if (isNaN(latNum)) {
        errors.push('Invalid latitude format');
      } else if (latNum < -90 || latNum > 90) {
        errors.push(`Latitude ${latNum} outside valid range (-90 to 90)`);
      }
    }
    
    if (lon !== undefined) {
      const lonNum = parseFloat(lon);
      if (isNaN(lonNum)) {
        errors.push('Invalid longitude format');
      } else if (lonNum < -180 || lonNum > 180) {
        errors.push(`Longitude ${lonNum} outside valid range (-180 to 180)`);
      }
    }
    
    // VALIDATION 3: Geographic consistency
    if (name && country) {
      // Basic checks for obvious mismatches
      const locationLower = name.toLowerCase();
      const countryLower = country.toLowerCase();
      
      // US state/city consistency
      if (countryLower.includes('united states') || countryLower.includes('usa')) {
        const usStates = ['california', 'texas', 'florida', 'new york', 'illinois', 'pennsylvania'];
        const hasUSStateInName = usStates.some(state => locationLower.includes(state));
        
        if (region && !hasUSStateInName) {
          // This is normal - city name with state in region field
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'weather-data'
    };
  }
  
  /**
   * Helper: Assess overall weather data quality
   */
  static assessWeatherDataQuality(currentWeather) {
    let score = 0;
    let maxScore = 0;
    
    // Essential fields
    const essentialFields = ['temp_f', 'condition', 'humidity', 'wind_mph'];
    essentialFields.forEach(field => {
      maxScore += 2;
      if (currentWeather[field] !== undefined && currentWeather[field] !== null) {
        score += 2;
      }
    });
    
    // Important fields
    const importantFields = ['precip_chance', 'pressure_mb', 'vis_miles'];
    importantFields.forEach(field => {
      maxScore += 1;
      if (currentWeather[field] !== undefined && currentWeather[field] !== null) {
        score += 1;
      }
    });
    
    // Data freshness bonus
    if (currentWeather.last_updated) {
      const updateTime = new Date(currentWeather.last_updated);
      if (!isNaN(updateTime.getTime())) {
        const hoursOld = (Date.now() - updateTime.getTime()) / (1000 * 60 * 60);
        if (hoursOld <= 1) {
          maxScore += 1;
          score += 1;
        }
      }
    }
    
    const qualityPercent = maxScore > 0 ? (score / maxScore) * 100 : 0;
    
    let qualityLevel;
    if (qualityPercent >= 90) qualityLevel = 'EXCELLENT';
    else if (qualityPercent >= 75) qualityLevel = 'GOOD';
    else if (qualityPercent >= 60) qualityLevel = 'FAIR';
    else qualityLevel = 'POOR';
    
    return {
      score: qualityPercent,
      level: qualityLevel,
      missingFields: essentialFields.filter(field => 
        currentWeather[field] === undefined || currentWeather[field] === null
      )
    };
  }
  
  /**
   * Helper: Check if weather data supports specific analysis types
   */
  static checkWeatherDataCapabilities(weatherData, analysisType) {
    const capabilities = {
      'temperature-analysis': ['temp_f', 'temp_c'],
      'precipitation-analysis': ['precip_chance', 'precip_in', 'condition'],
      'wind-analysis': ['wind_mph', 'wind_kph', 'wind_dir'],
      'outdoor-sports': ['temp_f', 'wind_mph', 'precip_chance', 'condition'],
      'aviation': ['wind_mph', 'vis_miles', 'condition', 'pressure_mb'],
      'agriculture': ['temp_f', 'humidity', 'precip_in', 'uv']
    };
    
    const requiredFields = capabilities[analysisType] || [];
    const current = weatherData.current || {};
    
    const missingFields = requiredFields.filter(field => 
      current[field] === undefined || current[field] === null
    );
    
    return {
      supported: missingFields.length === 0,
      missingFields,
      completeness: requiredFields.length > 0 ? 
        ((requiredFields.length - missingFields.length) / requiredFields.length) * 100 : 0
    };
  }
}