import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:ytm_clone/services/google_auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // STABLE SERVER FIX FOR VITE
  try {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 8080);
    server.listen((HttpRequest request) async {
      try {
        // ROBUST PATH HANDLING: Remove leading slash and handle empty/root paths
        String path = request.uri.path;
        if (path == '/') {
          path = 'index.html';
        } else if (path.startsWith('/')) {
          path = path.substring(1);
        }
        
        // Clean any double slashes if they occur
        path = path.replaceAll('//', '/');

        final byteData = await rootBundle.load('assets/www/$path');
        final bytes = byteData.buffer.asUint8List();
        
        // ROBUST MIME TYPES: Mandatory for modern web frameworks like Vite
        if (path.endsWith('.html')) {
          request.response.headers.contentType = ContentType.html;
        } else if (path.endsWith('.js') || path.endsWith('.mjs')) {
          request.response.headers.contentType = ContentType('application', 'javascript', charset: 'utf-8');
        } else if (path.endsWith('.css')) {
          request.response.headers.contentType = ContentType('text', 'css', charset: 'utf-8');
        } else if (path.endsWith('.svg')) {
          request.response.headers.contentType = ContentType('image', 'svg+xml');
        } else if (path.endsWith('.png')) {
          request.response.headers.contentType = ContentType('image', 'png');
        } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
          request.response.headers.contentType = ContentType('image', 'jpeg');
        } else if (path.endsWith('.json')) {
          request.response.headers.contentType = ContentType.json;
        }
        
        request.response.add(bytes);
      } catch (e) {
        // If file not found or error, return 404
        request.response.statusCode = HttpStatus.notFound;
        debugPrint("Asset load error: $e");
      } finally {
        await request.response.close();
      }
    });
  } catch (e) {
    debugPrint("Critical Server Error: $e");
  }

  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: YTMApp(),
  ));
}

class YTMApp extends StatefulWidget {
  const YTMApp({super.key});
  @override
  State<YTMApp> createState() => _YTMAppState();
}

class _YTMAppState extends State<YTMApp> {
  final GoogleAuthService _authService = GoogleAuthService();
  InAppWebViewController? _webViewController;
// Inside your State class where the WebView is initialized
late final WebViewController _controller;

@override
void initState() {
  super.initState();
  _controller = WebViewController()
    ..setJavaScriptMode(JavaScriptMode.unrestricted)
    // Create the channel named 'FlutterAuth'
    ..addJavaScriptChannel(
      'FlutterAuth',
      onMessageReceived: (JavaScriptMessage message) {
        if (message.message == 'triggerGoogleLogin') {
          _handleNativeGoogleSignIn();
        }
      },
    )
    ..loadRequest(Uri.parse('YOUR_WEB_APP_URL'));
}

Future<void> _handleNativeGoogleSignIn() async {
  try {
    final GoogleSignIn _googleSignIn = GoogleSignIn();
    final GoogleSignInAccount? account = await _googleSignIn.signIn();
    
    if (account != null) {
      // Send the user data back to React
      final String userJson = '{"email": "${account.email}", "full_name": "${account.displayName}", "id": "${account.id}", "avatar_url": "${account.photoUrl}"}';
      
      // Call a function you define in React to handle the result
      await _controller.runJavaScript('window.onNativeLoginSuccess($userJson)');
    }
  } catch (error) {
    print("Google Sign-In Error: $error");
  }
}
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            InAppWebView(
              initialUrlRequest: URLRequest(
                url: WebUri("http://localhost:8080/index.html"), 
              ),
              initialSettings: InAppWebViewSettings(
                mediaPlaybackRequiresUserGesture: false,
                allowsInlineMediaPlayback: true,
                javaScriptEnabled: true,
                domStorageEnabled: true,
                // Allow self-signed or local content
                mixedContentMode: MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
              ),
              onWebViewCreated: (controller) {
                _webViewController = controller;
              },
              // ROBUST LOADING: If the server is slow to start, retry on failure
              onReceivedError: (controller, request, error) {
                if (request.url.toString().contains("localhost:8080")) {
                  Future.delayed(const Duration(milliseconds: 500), () {
                    controller.reload();
                  });
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
