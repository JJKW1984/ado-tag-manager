import "azure-devops-ui/Core/override.css";
import * as SDK from "azure-devops-extension-sdk";
import React from "react";
import ReactDOM from "react-dom";
import { TagManagerApp } from "../app/TagManagerApp";

SDK.init().then(() => {
  ReactDOM.render(<TagManagerApp />, document.getElementById("root"));
  SDK.notifyLoadSucceeded();
});
