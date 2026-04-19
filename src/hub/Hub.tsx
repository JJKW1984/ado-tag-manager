import "azure-devops-ui/Core/override.css";
import * as SDK from "azure-devops-extension-sdk";
import React from "react";
import ReactDOM from "react-dom";
import { TagManagerApp } from "../app/TagManagerApp";
import { initializeIconSupport } from "../app/icons/initializeIconSupport";

SDK.init().then(() => {
  initializeIconSupport();
  ReactDOM.render(<TagManagerApp />, document.getElementById("root"));
  SDK.notifyLoadSucceeded();
});
