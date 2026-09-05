import * as React from "react";
import type { SvgProps } from "react-native-svg";
import Svg, { Circle, Path, Polygon, Text } from "react-native-svg";

const AetherLogo = (props: SvgProps) => (
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    width={128}
    height={32}
    viewBox="0 0 128 32"
    {...props}
  >
    <Polygon points="16,6 29,12 16,18 3,12" />
    <Path d="M11 15.4v5.2c0 2.4 10 2.4 10 0v-5.2l-5 2.5z" />
    <Path d="M26.6 12h1.8v8.2h-1.8z" />
    <Circle cx={27.5} cy={22.6} r={1.8} />
    <Text
      x={36}
      y={22.5}
      fontSize={18}
      fontWeight={800}
      letterSpacing={1.5}
    >
      aether
    </Text>
  </Svg>
);

export default AetherLogo;
