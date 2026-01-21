export const interfaceVersion = "1.4";
export const interfacePath = "https://player.8i.com/interface/" + interfaceVersion;

export const userAgentIs = {
  Android: function () {
    return navigator.userAgent.match(/Android/i);
  },
  BlackBerry: function () {
    return navigator.userAgent.match(/BlackBerry/i);
  },
  iOS: function () {
    return navigator.userAgent.match(/iPhone|iPad|iPod/i);
  },
  Safari: function () {
    return userAgentIs.iOS();
  },
  PureSafari: function () {
    return (
      userAgentIs.iOS() && navigator.userAgent.indexOf("CriOS") == -1 && navigator.userAgent.indexOf("FxiOS") == -1
    );
  },
  Opera: function () {
    return navigator.userAgent.match(/Opera Mini/i);
  },
  Windows: function () {
    return navigator.userAgent.match(/IEMobile/i);
  },
  mobile: function () {
    return (
      userAgentIs.Android() ||
      userAgentIs.BlackBerry() ||
      userAgentIs.iOS() ||
      userAgentIs.Opera() ||
      userAgentIs.Windows()
    );
  },
  notMobile: function () {
    return !userAgentIs.mobile();
  },
  eighthWall: function () {
    return window.XRExtras !== undefined;
  },
};

export const isWebGL2Supported = () => !!document.createElement("canvas").getContext("webgl2");

export const displayLoadingError = () => {
  const css = document.createElement("style");
  css.type = "text/css";
  css.innerHTML = `
        volcap-player#player #unavailable-message {
          margin: 30px auto;
          max-width: 350px;
          text-align: center;
          color: #6c6c6c;
          font-size: 1.5rem;
        }
    `;
  document.body.appendChild(css);
  const playerElement = document.querySelector("volcap-player#player");
  const unavailableMessage = document.createElement("div");
  unavailableMessage.id = "unavailable-message";
  unavailableMessage.innerHTML = `
      <p>Sorry! Your browser does not support watching this hologram.</p>
      <p>Plaase try using the latest version of Chrome, Firefox or Safari!</p>
    `;
  playerElement.appendChild(unavailableMessage);
};
