import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function PronoteIndexRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: "./locate", params }} />;
}
