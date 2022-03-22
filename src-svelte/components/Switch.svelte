<script>
    export let checked = false;
</script>
  
  <style>
    .switch {
      position: relative;
      display: inline-block;
      width: 149px;
      height: 49px;
    }
  
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
  
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      -webkit-transition: 0.4s;
      transition: 0.4s;
      border-radius: 34px;
    }
  
    .slider:before {
      position: absolute;
      content: "";
      height: 41px;
      width: 41px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      -webkit-transition: 0.4s;
      transition: 0.4s;
      border-radius: 50%;
    }
  
    input:checked + .slider {
      background: var(--main-grad);
    }
  
  
    input:checked + .slider:before {
      -webkit-transform: translateX(98px);
      -ms-transform: translateX(98px);
      transform: translateX(98px);
    }
  </style>
  
  <label class="switch">
    <input type="checkbox" bind:checked />
    <span class="slider" />
  </label>