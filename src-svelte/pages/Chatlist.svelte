<script>
  import * as core from '../functions.js'
  import Swtich from "../components/Switch.svelte";

  let serverlink;
  let message;

  let stopstart = false;

</script>

<div class="content">
  <div class="tlgrid">
    <div class="btn grad" on:click={core.openProxyWindow}>PROXIES</div>
    <div class="btn grad" on:click={core.openTokenWindow}>TOKENS</div>
    <div class="inlineserver">
      <div class="btn grad" on:click={core.joinServer()}>JOIN SERVER</div>
      <div class="serverlink">
        <textarea bind:value={serverlink}
          placeholder="Server link"
          name="serverlink"
          id="sl"
          cols="30"
          rows="10"
        />
      </div>
    </div>
  </div>
  <div class="logs"><div class="head">Logs</div></div>
  <div class="blgrid">
    <div>Stop Start Chatbot</div>
    <Swtich bind:checked={stopstart} />
  </div>
  <div class="chatlog"><div class="head">Chatlog</div></div>
  <div class="message">
    <textarea
    bind:value={message}
      placeholder="Enter text message"
      name="message"
      id="m"
      cols="30"
      rows="10"
    />
  </div>
</div>

<style lang="scss">
  .content {
    width: 98%;
    height: 750px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1.3fr 0.7fr;
    gap: 0px 0px;
    grid-template-areas:
      "tl chatlog"
      "logs chatlog"
      "start message";
  }
  .inlineserver {
    display: inline-flex;
    gap: 2em;
  }
  .serverlink {
    width: 210px;
    height: 49px;
    justify-content: center;
    display: flex;
    align-items: center;
    textarea {
      resize: none;
      border: none;
      outline: none;
      color: var(--main-color);
      overflow: hidden;
      font-size: 26px;
      align-content: center;
      text-decoration: none;
      background-color: var(--light-background);
      width: 210px;
      height: 30px;
    }
  }
  .message {
    grid-area: message;
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    textarea {
      resize: none;
      border: none;
      font-size: 20px;
      outline: none;
      color: var(--main-color);
      overflow: hidden;
      align-content: center;
      text-decoration: none;
      background-color: var(--light-background);
      width: 100%;
      height: 100px;
    }
  }
  .blgrid {
    align-self: center;
    width: calc(388px - 1em);
    gap: 3em;
    font-size: 18px;
    font-weight: 600;
    padding-left: 1em;
    height: 104px;
    background-color: var(--light-background);
    display: inline-flex;
    align-items: center;
    grid-area: start;
  }
  .logs {
    width: 388px;
    height: 327px;
    background-color: rgba(255, 255, 255, 0.14901960784313725);
    grid-area: logs;

    .head {
      width: 100%;
      padding: 8px;
    }
  }

  .chatlog {
    width: 435px;
    height: 100%;
    grid-area: chatlog;
    background-color: rgba(255, 255, 255, 0.14901960784313725);

    .head {
      width: 100%;
      padding: 8px;
    }
  }

  .tlgrid {
    grid-area: tl;
    height: 250px;
    width: 50%;
    flex-wrap: wrap;
    display: flex;
    flex-direction: column;
    row-gap: 2em;
    column-gap: 1em;
  }
</style>
