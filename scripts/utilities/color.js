const colorRange = 255;

/*
Class that represents color in RGBA format.
Parameters r, g, b range from 0 to 255.
Parameter alpha ranges from 0 to 255.
 */
class Color {
  constructor(r, g, b, alpha = colorRange) {
    const toCheck = [r, g, b, alpha];
    toCheck.forEach((value) => checkRange(value));

    this.r = r;
    this.g = g;
    this.b = b;
    this.alpha = alpha;
  }

  //"Factory method" that creates color from given HEX value
  static fromHex(hexColor) {
    const radix = 16;

    const expression = new RegExp(/#(.{2})(.{2})(.{2})(.{0,2})/);
    //Getting second to fifth group
    const result = expression.exec(hexColor).slice(1, 5);
    const values = result.map((value) => {
      if (value !== '') return parseInt(value, radix);
      else return colorRange;
    });

    return new Color(...values);
  }

  /*
  Refer to the link to get to know more about the algorithm:
  https://www.wikiwand.com/en/Alpha_compositing
   */
  blend(color) {
    const alphaA = color.alpha / colorRange;
    const alphaB = this.alpha / colorRange;

    const newAlpha = alphaA + alphaB * (1 - alphaA);
    const getParam = (parameterA, parameterB) => {
      const numerator = parameterA * alphaA + parameterB * (1 - alphaA);
      return Math.floor(numerator / newAlpha);
    };

    return new Color(
      getParam(color.r, this.r),
      getParam(color.g, this.g),
      getParam(color.b, this.b),
      newAlpha * colorRange
    );
  }

  //Converts color to RGBA CSS format
  toString() {
    return `rgba(${this.r},${this.g},${this.b},${this.alpha / colorRange})`;
  }
}

function checkRange(parameter) {
  if (parameter < 0 || parameter > colorRange) {
    throw Error(`Parameter ${parameter} is not in range 0...${colorRange}`);
  }
}

export { Color };
