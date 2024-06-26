var term = $('#terminal').terminal({
    // Function for the /register command
    "/register": function () {
      const { input, password } = $.terminal.forms.types;

      var spec = [
        {
          type: input,
          prompt: 'username: ',
          name: 'name'
        },
        {
          type: password,
          prompt: 'password: ',
          name: 'password'
        }
      ];

      $.terminal.forms.form(term, spec).then(function (form) {
        // Check if username is not empty
        if (form.name !== "") {
          // Hash the password
          var passwordBytes = new TextEncoder().encode(form.password);
          crypto.subtle.digest('SHA-256', passwordBytes).then(function(hashBuffer) {
            var hashedPassword = Array.prototype.map.call(new Uint8Array(hashBuffer), x => ('00' + x.toString(16)).slice(-2)).join('');

            // Send the username and hashed password to register.php using XHR
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "register.php", true);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.onreadystatechange = function () {
              if (xhr.readyState == 4 && xhr.status == 200) {
                term.echo(form.name + " has been registered.");
              }
              else if (xhr.readyState == 4 && xhr.status == 400){
                term.echo("username " + form.name + " is already taken.")
              }
            };
            xhr.send("username=" + encodeURIComponent(form.name) + "&password=" + encodeURIComponent(hashedPassword));
          });
        } else {
          term.echo("Please provide a username.");
        }
      });
    },
    "/login": function () {
      const { input, password } = $.terminal.forms.types;

      var spec = [
        {
          type: input,
          prompt: 'username: ',
          name: 'name'
        },
        {
          type: password,
          prompt: 'password: ',
          name: 'password'
        }
      ];

      $.terminal.forms.form(term, spec).then(function (form) {
        // Check if username is not empty
        if (form.name !== "") {
          // Hash the password
          var passwordBytes = new TextEncoder().encode(form.password);
          crypto.subtle.digest('SHA-256', passwordBytes).then(function(hashBuffer) {
            var hashedPassword = Array.prototype.map.call(new Uint8Array(hashBuffer), x => ('00' + x.toString(16)).slice(-2)).join('');

            // Send the username and hashed password to login.php using XHR
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "login.php", true);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                  term.echo("Login successful. :3");
                  setTimeout(function() {
                    window.location.href = '';  //add location here !important!
                  }, 1000);
                  
                } else {
                  term.echo("Invalid username or password. :(");
                }}
            };
            xhr.send("username=" + encodeURIComponent(form.name) + "&password=" + encodeURIComponent(hashedPassword));
          });
        } else {
          term.echo("Please provide a username.");
        }
      });
    }
  }, {
    greetings: 'Welcome to the Poyoweb',
    prompt: '>'
  });