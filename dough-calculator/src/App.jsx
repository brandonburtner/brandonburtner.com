import { useState } from "react";
import ConfigScreen from "./components/ConfigScreen";
import RecipeScreen from "./components/RecipeScreen";
import "./App.css";

export default function App() {
  const [screen, setScreen] = useState("config");
  const [config, setConfig] = useState(null);

  const handleCalculate = (configData) => {
    setConfig(configData);
    setScreen("recipe");
  };

  const handleEdit = () => {
    setScreen("config");
  };

  return (
    <div className="app">
      <div className="grain-overlay" />
      {screen === "config" ? (
        <ConfigScreen onCalculate={handleCalculate} initialConfig={config} />
      ) : (
        <RecipeScreen config={config} onEdit={handleEdit} />
      )}
    </div>
  );
}
